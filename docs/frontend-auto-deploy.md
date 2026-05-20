# Frontend Auto Deploy

This repo deploys automatically when changes are pushed to `main`.

The GitHub Actions workflow builds the Vite app, uploads `dist` to the production S3 bucket, then invalidates the CloudFront distribution.

## GitHub Environment

The workflow uses a GitHub environment named `production`.

No long-lived AWS access key is stored in GitHub. The workflow assumes this AWS role through OIDC:

```text
arn:aws:iam::379264687366:role/MaridOneFrontendGitHubDeployRole
```

The deploy values are defined in `.github/workflows/deploy-frontend.yml`:

- AWS region: `us-east-1`
- Frontend S3 bucket: `maridone-bucket`
- CloudFront distribution: `E2EQ71U8FR05ED`
- Frontend API base URL: `https://d3idr10dt23ah7.cloudfront.net`

## Required IAM Role

The role trusted by GitHub Actions should allow only this repository and the `production` environment to assume it.

The role needs permissions for:

- `s3:ListBucket` on the frontend bucket
- `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` on bucket objects
- `cloudfront:CreateInvalidation` on the website distribution

### Trust policy template

Replace `AWS_ACCOUNT_ID` with your account ID if the provider ARN needs it. Keep the repo/environment condition narrow.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:macoconut09/MaridOne-Frontend:environment:production"
        }
      }
    }
  ]
}
```

### Permissions policy template

Replace the bucket, account ID, and distribution ID placeholders.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListFrontendBucket",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::FRONTEND_S3_BUCKET"
    },
    {
      "Sid": "SyncFrontendObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::FRONTEND_S3_BUCKET/*"
    },
    {
      "Sid": "InvalidateFrontendDistribution",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::AWS_ACCOUNT_ID:distribution/CLOUDFRONT_DISTRIBUTION_ID"
    }
  ]
}
```

## Team Workflow

Groupmates should work on branches and open pull requests into `main`.

After a PR is merged into `main`, GitHub Actions deploys the updated frontend automatically.

Direct pushes to `main` also deploy automatically, but pull requests are safer because the app builds before changes land.
