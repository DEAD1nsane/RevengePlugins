import { React, ReactNative as RN } from "@vendetta/metro/common";
import { url } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";

import { BetterTableRowGroup } from "$/components/BetterTableRow";
import Text from "$/components/Text";
import { Button, TextInput } from "$/lib/redesign";
import { managePage } from "$/lib/ui";

import { lang } from "../..";
import { useAuthorizationStore } from "../../stores/AuthorizationStore";
import { getData } from "../../stuff/api";
import { buildOAuthURL } from "../../stuff/oauth2";

export default function ManualAuthPage({ navigation }: { navigation: any }) {
	const [token, setToken] = React.useState("");

	managePage({ title: "Manual authorization" }, navigation);

	return (
		<RN.ScrollView style={{ flex: 1 }}>
			<BetterTableRowGroup
				title="Manual authorization"
				icon={getAssetIDByName("LinkIcon")}
				padding
			>
				<Text variant="text-md/medium" color="TEXT_DEFAULT">
					{"The in-app login doesn't work on your Discord version.\n\n1. Open the browser login below and approve it.\n2. You'll land on a page showing your Cloud Sync token.\n3. Copy it, paste it here and save."}
				</Text>
				<RN.View style={{ height: 12 }} />
				<TextInput
					placeholder="Paste your Cloud Sync token here"
					value={token}
					onChange={setToken}
					isClearable
					size="md"
					autoCapitalize="none"
					autoCorrect={false}
				/>
				<RN.View style={{ height: 12 }} />
				<Button
					text="Open browser login"
					variant="secondary"
					size="md"
					onPress={() => url.openURL(buildOAuthURL())}
					style={{ marginVertical: 4 }}
				/>
				<Button
					text="Save token"
					disabled={!token.trim()}
					onPress={async () => {
						const clean = token.trim();
						if (!clean) return;
						useAuthorizationStore.getState().setToken(clean);
						try {
							await getData();
							showToast(
								lang.format("toast.oauth.authorized", {}),
								getAssetIDByName("CircleCheckIcon-primary"),
							);
							navigation?.goBack?.();
						} catch {
							useAuthorizationStore.getState().setToken(undefined);
						}
					}}
				/>
			</BetterTableRowGroup>
			<RN.View style={{ height: 12 }} />
		</RN.ScrollView>
	);
}
