# Infra Notes

This folder stores environment-specific deployment notes and parameter examples.

## Shared Cognito (Good Roots Network)

The backend SAM template supports reusing an existing Cognito User Pool.
Set these parameters at deploy time:

- `SharedUserPoolId`
- `SharedUserPoolClientId`

Example:

```bash
sam deploy \
  --stack-name okra-project-dev \
  --parameter-overrides \
    SharedUserPoolId=us-east-1_XXXX \
    SharedUserPoolClientId=YYYY
```
