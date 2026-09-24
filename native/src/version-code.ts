import { readFileSync } from 'node:fs';

/**
 * Rechnet eine semver-Version (major.minor.patch) in den monotonen Android-versionCode um
 * (docs/plan-native-apps.md, Stufe 1). Spiegel zur Ableitung in native/android/app/build.gradle.
 */
export function versionCodeFrom(version: string): number {
	const parts = version.split('.').map(Number);
	if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
		throw new Error(`Ungueltiges Versionsschema: ${version}`);
	}
	const [major, minor, patch] = parts;
	return major * 10000 + minor * 100 + patch;
}

/** Aktuelle Version der Root-package.json — dieselbe Quelle, die Gradle beim Build liest. */
export function rootVersion(): string {
	const rootPackage = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
		version: string;
	};
	return rootPackage.version;
}
