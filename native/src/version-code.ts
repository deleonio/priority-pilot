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
	if (major > 209 || minor > 999 || patch > 9999) {
		throw new Error(`Version ausserhalb der versionCode-Grenzen (major<=209, minor<=999, patch<=9999): ${version}`);
	}
	return major * 10000000 + minor * 10000 + patch;
}

/** Aktuelle Version der Root-package.json — dieselbe Quelle, die Gradle beim Build liest. */
export function rootVersion(): string {
	const rootPackage = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
		version: string;
	};
	return rootPackage.version;
}
