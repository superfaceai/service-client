import { SDKProviderChangeType } from './sdk_provider_change_type';

export interface SDKConfigResponse {
  updated_at: string;
  configuration_hash: string;
  configuration: {
    profiles: {
      [profile: string]: {
        version: string;
        providers: Array<{
          provider: string;
          version: string;
          priority: number;
        }>;
      };
    };
  };
}

export interface SDKPerformStatisticsResponse {
  from: string;
  to: string;
  interval_minutes: number;
  account_handle: string;
  project_name: string;
  profile: string;
  statistics: Array<{
    provider: string;
    series: Array<{
      from: string;
      to: string;
      successful_performs: number;
      failed_performs: number;
    }>;
  }>;
}

export interface SDKProviderChangeResponse {
  changed_at: string;
  change_type: SDKProviderChangeType;
  profile: string;
  to_provider: string;
  from_provider: string;
  failover_reasons: Array<{
    reason: string; // TODO: This should be a proper enum
    occurred_at: string;
  }>;
}

export interface SDKProviderChangesListResponse {
  data: SDKProviderChangeResponse[];
}
