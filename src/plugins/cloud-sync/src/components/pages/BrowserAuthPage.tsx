import { React, ReactNative as RN } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";

import { WebView } from "$/deps";
import { managePage } from "$/lib/ui";

import { lang } from "../..";
import constants from "../../constants";
import { useAuthorizationStore } from "../../stores/AuthorizationStore";
import { getData } from "../../stuff/api";
import { buildOAuthURL } from "../../stuff/oauth2";

// In-app OAuth login: the backend answers the authorize redirect with the
// token as plain text, so read it straight out of the loaded page and finish
// authorization without any copy-paste.
export default function BrowserAuthPage({ navigation }: { navigation: any }) {
	const [done, setDone] = React.useState(false);

	managePage({ title: "Log in with Discord" }, navigation);

	const apiBase = constants.api;

	const captureJs =
		`(function(){try{if(location.href.indexOf(${JSON.stringify(apiBase)})===0){window.ReactNativeWebView.postMessage(document.body?document.body.innerText||"":"");}}}catch(e){}})();true;`;

	return (
		<RN.View style={{ flex: 1 }}>
			{!done && (
				<WebView
					source={{ uri: buildOAuthURL() }}
					injectedJavaScript={captureJs}
					onMessage={async (event: any) => {
						const token = (
							event?.nativeEvent?.data ?? ""
						).trim();
						if (
							!token
							|| token.startsWith("Missing")
							|| token.startsWith("Invalid")
							|| token.startsWith("Discord ratelimited")
							|| token.length < 10
						) {
							return;
						}

						setDone(true);
						useAuthorizationStore.getState().setToken(token);
						try {
							await getData();
							showToast(
								lang.format("toast.oauth.authorized", {}),
								getAssetIDByName("CircleCheckIcon-primary"),
							);
						} catch {
							useAuthorizationStore.getState().setToken(undefined);
							setDone(false);
							return;
						}
						navigation?.goBack?.();
					}}
					style={{ flex: 1 }}
				/>
			)}
			{done && (
				<RN.View
					style={{
						flex: 1,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<RN.ActivityIndicator size="large" />
				</RN.View>
			)}
		</RN.View>
	);
}
