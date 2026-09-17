#!/usr/bin/env node
import { App, Stack, Duration, CfnOutput, RemovalPolicy, CfnParameter } from 'aws-cdk-lib';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { UserPool, AccountRecovery, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { HttpApi, HttpMethod, CorsHttpMethod, CfnStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { RetentionDays, LogGroup } from 'aws-cdk-lib/aws-logs';
import { resolve } from 'node:path';
const app = new App();
const stack = new Stack(app, 'Stavira', {
  description: 'Stavira adaptive execution MVP',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});
const origin = new CfnParameter(stack, 'FrontendOrigin', {
  type: 'String',
  description: 'Exact HTTPS frontend origin, no trailing slash',
  allowedPattern: 'https://[^/]+',
  default: 'https://example.com',
});
const model = new CfnParameter(stack, 'BedrockModelId', {
  type: 'String',
  description: 'Enabled regional Bedrock foundation model ID; see README',
  default: 'amazon.nova-lite-v1:0',
});
const table = new Table(stack, 'Workspace', {
  partitionKey: { name: 'PK', type: AttributeType.STRING },
  sortKey: { name: 'SK', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  removalPolicy: RemovalPolicy.RETAIN,
});
const pool = new UserPool(stack, 'Users', {
  selfSignUpEnabled: true,
  signInAliases: { email: true },
  autoVerify: { email: true },
  standardAttributes: {
    email: { required: true, mutable: false },
    fullname: { required: false, mutable: true },
  },
  passwordPolicy: {
    minLength: 10,
    requireDigits: true,
    requireLowercase: true,
    requireUppercase: true,
    requireSymbols: true,
  },
  accountRecovery: AccountRecovery.EMAIL_ONLY,
  removalPolicy: RemovalPolicy.RETAIN,
});
const client = new UserPoolClient(stack, 'WebClient', {
  userPool: pool,
  generateSecret: false,
  authFlows: { userPassword: true },
  preventUserExistenceErrors: true,
  accessTokenValidity: Duration.hours(1),
  refreshTokenValidity: Duration.days(30),
});
const authorizer = new HttpUserPoolAuthorizer('Cognito', pool, { userPoolClients: [client] });
const api = new HttpApi(stack, 'Api', {
  defaultAuthorizer: authorizer,
  corsPreflight: {
    allowOrigins: [origin.valueAsString],
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PATCH],
    maxAge: Duration.hours(1),
  },
});
const groups = [
  { name: 'goals', routes: ['goals'], ai: false },
  { name: 'planning', routes: ['planning'], ai: true },
  { name: 'context', routes: ['workspace', 'check-ins'], ai: false },
  { name: 'recommendations', routes: ['recommendations'], ai: true },
  { name: 'execution', routes: ['execution'], ai: false },
  { name: 'adaptation', routes: ['adaptations'], ai: true },
];
for (const group of groups) {
  const fn = new NodejsFunction(stack, `${group.name}Function`, {
    entry: resolve(`functions/${group.name}.ts`),
    runtime: Runtime.NODEJS_22_X,
    architecture: Architecture.ARM_64,
    memorySize: 512,
    timeout: Duration.seconds(28),
    environment: {
      STAVIRA_MODE: 'aws',
      STAVIRA_TABLE: table.tableName,
      BEDROCK_MODEL_ID: model.valueAsString,
      NODE_ENV: 'production',
    },
    bundling: { minify: true, sourceMap: true },
    logGroup: new LogGroup(stack, `${group.name}Logs`, {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    }),
  });
  fn.addToRolePolicy(
    new PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:PutItem'],
      resources: [table.tableArn],
    }),
  );
  if (group.ai)
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          stack.formatArn({
            service: 'bedrock',
            account: '',
            resource: 'foundation-model',
            resourceName: model.valueAsString,
          }),
        ],
      }),
    );
  for (const route of group.routes) {
    api.addRoutes({
      path: `/${route}`,
      methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.PATCH],
      integration: new HttpLambdaIntegration(`${group.name}-${route}`, fn),
    });
    api.addRoutes({
      path: `/${route}/{proxy+}`,
      methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.PATCH],
      integration: new HttpLambdaIntegration(`${group.name}-${route}-proxy`, fn),
    });
  }
}
const stage = api.defaultStage?.node.defaultChild as CfnStage;
stage.defaultRouteSettings = { throttlingBurstLimit: 30, throttlingRateLimit: 15 };
new CfnOutput(stack, 'ApiUrl', { value: api.apiEndpoint });
new CfnOutput(stack, 'UserPoolId', { value: pool.userPoolId });
new CfnOutput(stack, 'ClientId', { value: client.userPoolClientId });
new CfnOutput(stack, 'TableName', { value: table.tableName });
