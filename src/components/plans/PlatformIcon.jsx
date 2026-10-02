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

  if (Icon) {
    return (
      <Box
        component="span"
        sx={{
          width: box,
          height: box,
          borderRadius: 1.25,
          position: "relative",
          overflow: "hidden",
          bgcolor: (theme) => theme.palette.mode === "dark"
            ? "rgba(226,232,240,.10)"
            : "rgba(255,255,255,.72)",
          backgroundImage: (theme) => theme.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(255,255,255,.22) 0%, rgba(203,213,225,.13) 34%, rgba(148,163,184,.08) 62%, rgba(255,255,255,.16) 100%)"
            : "linear-gradient(145deg, rgba(255,255,255,.98) 0%, rgba(226,232,240,.96) 34%, rgba(148,163,184,.62) 66%, rgba(255,255,255,.96) 100%)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          lineHeight: 0,
          border: "1px solid",
          borderColor: (theme) => theme.palette.mode === "dark"
            ? "rgba(248,250,252,.28)"
            : "rgba(100,116,139,.26)",
          boxShadow: (theme) => theme.palette.mode === "dark"
            ? "inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1px 0 rgba(15,23,42,.35), 0 2px 8px rgba(0,0,0,.18)"
            : "inset 0 1px 0 rgba(255,255,255,.98), inset 0 -1px 0 rgba(71,85,105,.22), 0 2px 8px rgba(15,23,42,.10)",
          "&::after": {
            content: '\"\"',
            position: "absolute",
            top: "-30%",
            left: "-35%",
            width: "45%",
            height: "170%",
            transform: "rotate(24deg)",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,.48), transparent)",
            opacity: 0.55,
            pointerEvents: "none",
          },
          "& svg": {
            display: "block",
            position: "relative",
            zIndex: 1,
            filter: (theme) => theme.palette.mode === "dark"
              ? "grayscale(1) brightness(1.72) contrast(.68) drop-shadow(0 1px 2px rgba(255,255,255,.18))"
              : "grayscale(1) brightness(.74) contrast(.72) drop-shadow(0 1px 1px rgba(255,255,255,.72))",
            opacity: 0.98,
          },
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
        position: "relative",
        overflow: "hidden",
        bgcolor: (theme) => theme.palette.mode === "dark"
          ? "rgba(226,232,240,.10)"
          : "rgba(255,255,255,.72)",
        backgroundImage: (theme) => theme.palette.mode === "dark"
          ? "linear-gradient(145deg, rgba(255,255,255,.22) 0%, rgba(203,213,225,.13) 34%, rgba(148,163,184,.08) 62%, rgba(255,255,255,.16) 100%)"
          : "linear-gradient(145deg, rgba(255,255,255,.98) 0%, rgba(226,232,240,.96) 34%, rgba(148,163,184,.62) 66%, rgba(255,255,255,.96) 100%)",
        color: (theme) => theme.palette.mode === "dark" ? "#f8fafc" : "#475569",
        fontSize: Math.max(10, size * 0.38),
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: -0.3,
        lineHeight: 1,
        border: "1px solid",
        borderColor: (theme) => theme.palette.mode === "dark"
          ? "rgba(248,250,252,.28)"
          : "rgba(100,116,139,.26)",
        boxShadow: (theme) => theme.palette.mode === "dark"
          ? "inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1px 0 rgba(15,23,42,.35), 0 2px 8px rgba(0,0,0,.18)"
          : "inset 0 1px 0 rgba(255,255,255,.98), inset 0 -1px 0 rgba(71,85,105,.22), 0 2px 8px rgba(15,23,42,.10)",
        "&::after": {
          content: """",
          position: "absolute",
          top: "-30%",
          left: "-35%",
          width: "45%",
          height: "170%",
          transform: "rotate(24deg)",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,.48), transparent)",
          opacity: 0.55,
          pointerEvents: "none",
        },
      }}
      title={label || platformKey}
    >
      {letter}
    </Box>
  );
});

export default PlatformIcon;
