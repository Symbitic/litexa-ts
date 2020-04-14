export interface IAWSContext {
  projectConfig: {
    root: string
  }
  skill: {
    projectInfo: {
      name: string
      variant: string
    }
  }
  deploymentName: string
  deploymentOptions: {
    awsProfile: string
    overrideAssetsRoot?: string
    s3Configuration?: {
      bucketName: string
    }
    S3BucketName?: string
  }
  artifacts: {
    save<T>(name: string, arg: T): void
    get<T>(name: string): T
  }
  assetDeploymentStart: number
  AWSConfig: any
  S3: any
};

export interface ILogger {
  log(msg: string): void;
  error(msg: string | Error): void;
};
