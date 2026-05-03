/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string
  readonly VITE_MAPBOX_STYLE_URL: string
  readonly VITE_MAPBOX_RTL_TEXT_PLUGIN_URL: string
  readonly VITE_MAPBOX_DIRECTIONS_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
