import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import RecordScreen from './src/screens/RecordScreen';
import QueryScreen from './src/screens/QueryScreen';
import LoginScreen from './src/screens/LoginScreen';

const DEVICE_USER_ID_KEY = 'device_user_id';

const Tab = createBottomTabNavigator();

const App = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(DEVICE_USER_ID_KEY)
      .then(stored => setUserId(stored))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <View style={{flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator color="#60a5fa" size="large" />
      </View>
    );
  }

  if (!userId) {
    return <LoginScreen onLogin={setUserId} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {backgroundColor: '#0f172a', borderTopColor: '#1e293b'},
          tabBarActiveTintColor: '#60a5fa',
          tabBarInactiveTintColor: '#475569',
        }}>
        <Tab.Screen
          name="Record"
          component={RecordScreen}
          options={{
            tabBarLabel: 'Record',
            tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>🎙</Text>,
          }}
        />
        <Tab.Screen
          name="Query"
          component={QueryScreen}
          options={{
            tabBarLabel: 'Ask',
            tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>🔍</Text>,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default App;
