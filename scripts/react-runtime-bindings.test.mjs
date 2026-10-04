import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject JSX component references that have no lexical binding",
    },
    schema: [],
    messages: {
      unbound: "JSX component `{{name}}` is referenced without a lexical binding in this module.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      JSXOpeningElement(node) {
        if (node.name?.type !== "JSXIdentifier") return;

        const name = node.name.name;
        if (!/^[A-Z]/.test(name)) return;

        let scope = sourceCode.getScope(node);
        while (scope) {
          if (scope.set?.has(name)) return;
          scope = scope.upper;
        }

        context.report({
          node: node.name,
          messageId: "unbound",
          data: { name },
        });
      },
    };
  },
};

test("all JSX component references in src are lexically bound", async () => {
  const eslint = new ESLint({
    overrideConfig: {
      plugins: {
        "runtime-bindings": { rules: { "no-unbound-jsx-components": rule } },
      },
      rules: {
        "runtime-bindings/no-unbound-jsx-components": "error",
      },
    },
  });

  const results = await eslint.lintFiles(["src/**/*.jsx"]);
  const errors = results.flatMap((result) =>
    result.messages
      .filter((message) => message.severity === 2)
      .map(
        (message) =>
          `${result.filePath}:${message.line}:${message.column} ${message.message}`,
      ),
  );

  assert.deepEqual(
    errors,
    [],
    `Unbound JSX component references found:\n${errors.join("\n")}`,
  );
});
