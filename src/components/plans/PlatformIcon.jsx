import React, { memo } from "react";
import { Box } from "@mui/material";

/* react-devicons — per-platform path imports (tree-shake friendly) */
import DjangoPlain from "react-devicons/django/plain";
import FlaskOriginal from "react-devicons/flask/original";
import NodejsOriginal from "react-devicons/nodejs/original";
import NextjsOriginal from "react-devicons/nextjs/original";
import ReactOriginal from "react-devicons/react/original";
import VuejsOriginal from "react-devicons/vuejs/original";
import NuxtjsOriginal from "react-devicons/nuxtjs/original";
import PythonOriginal from "react-devicons/python/original";
import GoOriginal from "react-devicons/go/original";
import RustOriginal from "react-devicons/rust/original";
import JavaOriginal from "react-devicons/java/original";
import SpringOriginal from "react-devicons/spring/original";
import PhpOriginal from "react-devicons/php/original";
import LaravelOriginal from "react-devicons/laravel/original";
import RailsPlain from "react-devicons/rails/plain";
import RubyOriginal from "react-devicons/ruby/original";
import DockerOriginal from "react-devicons/docker/original";
import PostgresqlOriginal from "react-devicons/postgresql/original";
import MysqlOriginal from "react-devicons/mysql/original";
import MongodbOriginal from "react-devicons/mongodb/original";
import RedisOriginal from "react-devicons/redis/original";
import SqliteOriginal from "react-devicons/sqlite/original";
import ElasticsearchOriginal from "react-devicons/elasticsearch/original";
import FastapiOriginal from "react-devicons/fastapi/original";
import AngularOriginal from "react-devicons/angular/original";
import SvelteOriginal from "react-devicons/svelte/original";
import TypescriptOriginal from "react-devicons/typescript/original";
import JavascriptOriginal from "react-devicons/javascript/original";
import CsharpOriginal from "react-devicons/csharp/original";
import KafkaOriginal from "react-devicons/apachekafka/original";
import LinuxOriginal from "react-devicons/linux/original";

/** Map normalized platform key → Devicon component */
const ICON_MAP = {
  django: DjangoPlain,
  flask: FlaskOriginal,
  fastapi: FastapiOriginal,
  node: NodejsOriginal,
  nodejs: NodejsOriginal,
  next: NextjsOriginal,
  nextjs: NextjsOriginal,
  react: ReactOriginal,
  vue: VuejsOriginal,
  vuejs: VuejsOriginal,
  nuxt: NuxtjsOriginal,
  nuxtjs: NuxtjsOriginal,
  python: PythonOriginal,
  go: GoOriginal,
  golang: GoOriginal,
  rust: RustOriginal,
  java: JavaOriginal,
  spring: SpringOriginal,
  php: PhpOriginal,
  laravel: LaravelOriginal,
  rails: RailsPlain,
  ruby: RubyOriginal,
  docker: DockerOriginal,
  postgres: PostgresqlOriginal,
  postgresql: PostgresqlOriginal,
  mysql: MysqlOriginal,
  mariadb: MysqlOriginal,
  mongo: MongodbOriginal,
  mongodb: MongodbOriginal,
  redis: RedisOriginal,
  sqlite: SqliteOriginal,
  elasticsearch: ElasticsearchOriginal,
  elastic: ElasticsearchOriginal,
  angular: AngularOriginal,
  svelte: SvelteOriginal,
  typescript: TypescriptOriginal,
  javascript: JavascriptOriginal,
  js: JavascriptOriginal,
  ts: TypescriptOriginal,
  csharp: CsharpOriginal,
  kafka: KafkaOriginal,
  apachekafka: KafkaOriginal,
  linux: LinuxOriginal,
};

/** Soft contrasting backgrounds so brand icons stay readable on any theme */
const ICON_BG = {
  django: "#0C4B33",
  flask: "#E8E8E8",
  fastapi: "#059669",
  node: "#E8F5E9",
  nodejs: "#E8F5E9",
  next: "#111111",
  nextjs: "#111111",
  react: "#0B1A2A",
  vue: "#E8F8F0",
  vuejs: "#E8F8F0",
  nuxt: "#E8F8F0",
  nuxtjs: "#E8F8F0",
  python: "#1E3A5F",
  go: "#E3F2FD",
  golang: "#E3F2FD",
  rust: "#F5E6D3",
  java: "#FFF3E0",
  spring: "#E8F5E9",
  php: "#EDE7F6",
  laravel: "#FDECEA",
  rails: "#FDECEA",
  ruby: "#FDECEA",
  docker: "#E3F2FD",
  postgres: "#E3F2FD",
  postgresql: "#E3F2FD",
  mysql: "#FFF8E1",
  mariadb: "#FFF8E1",
  mongo: "#E8F5E9",
  mongodb: "#E8F5E9",
  redis: "#FDECEA",
  sqlite: "#E3F2FD",
  elasticsearch: "#FFF3E0",
  elastic: "#FFF3E0",
  angular: "#FDECEA",
  svelte: "#FDECEA",
  typescript: "#E3F2FD",
  javascript: "#FFF8E1",
  js: "#FFF8E1",
  ts: "#E3F2FD",
  csharp: "#EDE7F6",
  kafka: "#F5F5F5",
  apachekafka: "#F5F5F5",
  linux: "#FFF8E1",
};

function resolveBg(key, label) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const k = norm(key);
  const l = norm(label);
  if (ICON_BG[k]) return ICON_BG[k];
  if (ICON_BG[l]) return ICON_BG[l];
  const hit = Object.keys(ICON_BG).find((id) => k.includes(id) || l.includes(id));
  return hit ? ICON_BG[hit] : "rgba(128,128,128,0.18)";
}

function resolveIcon(key, label) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const k = norm(key);
  const l = norm(label);
  if (ICON_MAP[k]) return ICON_MAP[k];
  if (ICON_MAP[l]) return ICON_MAP[l];
  const hit = Object.keys(ICON_MAP).find((id) => k.includes(id) || l.includes(id));
  return hit ? ICON_MAP[hit] : null;
}

/**
 * Platform brand icon via react-devicons.
 * Falls back to a letter badge when no matching icon exists.
 */
const PlatformIcon = memo(function PlatformIcon({ platformKey, label, size = 22 }) {
  const Icon = resolveIcon(platformKey, label);
  const pad = Math.max(4, Math.round(size * 0.22));
  const box = size + pad * 2;
  const bg = resolveBg(platformKey, label);

  if (Icon) {
    return (
      <Box
        component="span"
        sx={{
          width: box,
          height: box,
          borderRadius: 1.25,
          bgcolor: bg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          lineHeight: 0,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
          "& svg": { display: "block" },
        }}
        title={label || platformKey}
      >
        <Icon size={size} />
      </Box>
    );
  }

  const letter = String(label || platformKey || "?").slice(0, 2);
  return (
    <Box
      component="span"
      sx={{
        width: box,
        height: box,
        borderRadius: 1.25,
        bgcolor: bg,
        color: "#fff",
        fontSize: Math.max(10, size * 0.38),
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: -0.3,
        lineHeight: 1,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
      }}
      title={label || platformKey}
    >
      {letter}
    </Box>
  );
});

export default PlatformIcon;
