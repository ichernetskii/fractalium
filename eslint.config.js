import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import esLintPluginPrettier from "eslint-plugin-prettier/recommended";
import react from "eslint-plugin-react";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
	{ ignores: ["dist", "node_modules", ".pnp.*"] },
	{
		settings: {
			react: { version: "19.0" },
		},
		extends: [
			js.configs.recommended,
			importPlugin.flatConfigs.recommended,
			...tseslint.configs.strictTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
			esLintPluginPrettier,
		],
		files: ["src/**/*.{ts,tsx,js,jsx}", "vite.config.ts"],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
			parserOptions: {
				project: ["./tsconfig.node.json", "./tsconfig.app.json"],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			"react-hooks": reactHooks,
			"react-refresh": reactRefresh,
			react,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			...react.configs.recommended.rules,
			...react.configs["jsx-runtime"].rules,
			"@typescript-eslint/restrict-template-expressions": "off",
			"react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
			"import/order": [
				"error",
				{
					"newlines-between": "never",
					alphabetize: {
						order: "asc",
					},
					named: true,
				},
			],
		},
	},
);
