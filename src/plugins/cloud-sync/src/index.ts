import { constants } from "@vendetta";
import { findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { plugins } from "@vendetta/plugins";
import { themes } from "@vendetta/themes";

import { Lang } from "$/lang";

import Settings from "./components/Settings";
import { useAuthorizationStore } from "./stores/AuthorizationStore";
import { useCacheStore } from "./stores/CacheStore";
import { getData, saveData } from "./stuff/api";
import { debounceSync } from "./stuff/http";
import patcher from "./stuff/patcher";
import { grabEverything } from "./stuff/syncStuff";

const UserStore = findByStoreName("UserStore");

export const vstorage = storage as {
	config: {
		autoSync: boolean;
		autoSyncDisarmed?: boolean;
		addToSettings: boolean;
		ignoredPlugins: string[];
	};
	custom: {
		host: string;
		clientId: string;
	};
	realTrackingAnalyticsSentToChina: {
		pressedSettings?: boolean;
		tooMuchData?: boolean;
	};
};

export function isPluginProxied(id: string) {
	return [
		constants.PROXY_PREFIX,

		// STUB[epic=types] constants :3
		// @ts-expect-error Bunny types stub
		constants.BUNNY_PROXY_PREFIX,
	].some(x => id.startsWith(x));
}
export function canImport(id: string) {
	return !id.includes("cloud-sync");
}

const autoSync = async () => {
	if (!useAuthorizationStore.getState().isAuthorized()) {
		return;
	}

	// Skip the storage scan entirely when the user deliberately turned
	// auto-sync off (as opposed to it being disarmed by the empty guard).
	if (!vstorage.config.autoSync && !vstorage.config.autoSyncDisarmed) {
		return;
	}

	const cache = useCacheStore.getState();
	const everything = await grabEverything();

	const hasContent = Object.keys(everything.plugins).length > 0
		|| Object.keys(everything.themes).length > 0
		|| Object.keys(everything.fonts.installed).length + everything.fonts.custom.length > 0;

	if (!hasContent) {
		// Local state looks wiped or corrupt: never upload it, and disarm
		// auto-sync so the cloud backup survives. Re-arms automatically
		// once real content is back. A manual off is left untouched.
		if (vstorage.config.autoSync) {
			vstorage.config.autoSync = false;
			vstorage.config.autoSyncDisarmed = true;
		}
		return;
	}

	if (vstorage.config.autoSyncDisarmed) {
		vstorage.config.autoSyncDisarmed = false;
		vstorage.config.autoSync = true;
	}

	if (!vstorage.config.autoSync) {
		return;
	}

	if (JSON.stringify(cache.data) !== JSON.stringify(everything)) {
		// let's double check
		const userId = UserStore.getCurrentUser()?.id ?? null;
		if (initState.didInit !== userId) {
			initState.didInit = userId;
			await getData();
		}

		if (JSON.stringify(cache.data) !== JSON.stringify(everything)) {
			debounceSync(async () => {
				try {
					if (useAuthorizationStore.getState().isAuthorized()) {
						await saveData(everything);
					}
				} catch (e: any) {
					if (
						e?.message
							?.toLowerCase()
							.includes("request entity too large")
					) {
						vstorage.realTrackingAnalyticsSentToChina.tooMuchData = true;
						vstorage.config.autoSync = false;
					}
				}
			});
		}
	}
};

const emitterSymbol = Symbol.for("vendetta.storage.emitter");

export const lang = new Lang("cloud_sync");
export const initState = {
	didInit: null,
};

const patches: (any)[] = [];
export function onLoad() {
	vstorage.config ??= {
		autoSync: true,
		addToSettings: true,
		ignoredPlugins: [],
	};
	vstorage.custom ??= {
		host: "",
		clientId: "",
	};
	vstorage.realTrackingAnalyticsSentToChina ??= {
		pressedSettings: false,
		tooMuchData: false,
	};

	const emitters = {
		plugins: (plugins as any)[emitterSymbol] as Emitter,
		themes: (themes as any)[emitterSymbol] as Emitter,
	};

	emitters.plugins.on("SET", autoSync);
	emitters.themes.on("SET", autoSync);
	emitters.plugins.on("DEL", autoSync);
	emitters.themes.on("DEL", autoSync);

	patches.push(() => {
		emitters.plugins.off("SET", autoSync);
		emitters.themes.off("SET", autoSync);
		emitters.plugins.off("DEL", autoSync);
		emitters.themes.off("DEL", autoSync);
	});

	patches.push(patcher());
	patches.push(lang.unload);
}

export function onUnload() {
	for (const x of patches) x();
}

export const settings = Settings;
