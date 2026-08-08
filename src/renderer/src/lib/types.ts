export interface Proxy {
  type: string
  host: string
  port: string
}

export interface Gmail {
  email: string
  password: string
}

export interface Profile {
  uuid: string
  title: string
  os: string
  status: 'active' | 'stopped'
  tags: string[]
  proxy: Proxy | null
  gmail?: Gmail | null
  url?: string
  gscProperty?: string
  group?: string
  brand?: string
  lastActive: number
  createdAt?: number
  usage?: number
  verified?: boolean
}

export interface Store {
  profiles: Profile[]
  proxies?: Proxy[]
  updatedAt?: number
}

export interface Cfg {
  localUrl: string
  token: string
  live: boolean
  supaUrl: string
  supaKey: string
}

export type ViewName = 'overview' | 'profiles' | 'proxies' | 'automation' | 'settings'
