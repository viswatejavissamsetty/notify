import * as Clipboard from "expo-clipboard";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import { Button, Platform, Text, View } from "react-native";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import Constants from "expo-constants";
async function getUniqueDeviceId() {
  let deviceId: string = "";

  try {
    deviceId = await SecureStore.getItemAsync("device_id");
  } catch (error) {
    deviceId = "";
  }

  if (!deviceId) {
    deviceId = uuidv4().toString();
    await SecureStore.setItemAsync("device_id", deviceId);
  }

  return deviceId;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState("");
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Clipboard.Subscription>();
  const responseListener = useRef<Clipboard.Subscription>();
  const [errorMessage, setErrorMessage] = useState("");
  const [experienceId, setExperienceId] = useState("");

  useEffect(() => {
    getUniqueDeviceId()
      .then((deviceId) => {
        setExperienceId(deviceId);
        registerForPushNotificationsAsync(deviceId)
          .then((token) => setExpoPushToken(token))
          .catch((err) => {
            console.log(err);
            setErrorMessage(JSON.stringify(err));
          });
      })
      .catch((err) => console.log(err));

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        setNotification(notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        setNotification(response.notification);
      });

    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current
      );
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  const copyToClipboard = async (text) => {
    await Clipboard.setStringAsync(text);
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "space-around",
      }}
    >
      <Text>Your expo push token: {expoPushToken}</Text>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Text>Title: {notification?.request?.content?.title} </Text>
        <Text>Body: {notification?.request?.content?.body}</Text>
        <Text>
          Data:{" "}
          {notification && JSON.stringify(notification.request.content.data)}
        </Text>
        <Text>ExperienceId: {experienceId}</Text>
      </View>
      <Button
        title="Press to schedule a notification"
        onPress={async () => {
          await schedulePushNotification();
        }}
      />
      {Boolean(errorMessage) && <Text>{errorMessage}</Text>}
      {Boolean(expoPushToken) && (
        <Button
          title="Copy Token to clipboard"
          onPress={() => copyToClipboard(expoPushToken)}
        />
      )}
    </View>
  );
}

async function schedulePushNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "You've got mail! 📬",
      body: "Here is the notification body",
      data: { data: "goes here" },
    },
    trigger: { seconds: 2 },
  });
}

async function registerForPushNotificationsAsync(experienceId: string) {
  let token: string = "";

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync({
        android: { experienceId: experienceId },
        ios: {},
      });
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      alert("Failed to get push token for push notification!");
      return;
    }

    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig.extra?.eas?.projectId,
      })
    ).data;

    console.log(token);
  } else {
    alert("Must use physical device for Push Notifications");
  }

  return token;
}
