/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-no-outer-layers",
      severity: "error",
      comment: "domain層は外側の層（application, infrastructure, presentation, app）に依存してはいけません。",
      from: { path: "^src/domain" },
      to: { path: "^src/(application|infrastructure|presentation|app)" },
    },
    {
      name: "domain-no-external-packages",
      severity: "error",
      comment: "domain層は純粋なTypeScriptのみで構成し、外部ライブラリに依存してはいけません。",
      from: { path: "^src/domain" },
      to: { path: "^node_modules" },
    },
    {
      name: "application-no-outer-layers",
      severity: "error",
      comment: "application層はinfrastructure・presentation・app層に依存してはいけません。",
      from: { path: "^src/application" },
      to: { path: "^src/(infrastructure|presentation|app)" },
    },
    {
      name: "infrastructure-no-presentation",
      severity: "error",
      comment: "infrastructure層はpresentation・app層に依存してはいけません。",
      from: { path: "^src/infrastructure" },
      to: { path: "^src/(presentation|app)" },
    },
    {
      name: "no-circular-dependencies",
      severity: "error",
      comment: "循環参照（AがBをimportし、BがAをimportする状態）は禁止です。",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};