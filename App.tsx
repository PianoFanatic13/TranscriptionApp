import React, {useState} from 'react';
import {Text} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import RecordScreen from './src/screens/RecordScreen';
import QueryScreen from './src/screens/QueryScreen';
import LoginScreen from './src/screens/LoginScreen';

const Tab = createBottomTabNavigator();

const App = () => {
  const [userId, setUserId] = useState<string | null>(null);

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
          options={{
            tabBarLabel: 'Record',
            tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>🎙</Text>,
          }}>
          {() => <RecordScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Query"
          options={{
            tabBarLabel: 'Ask',
            tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>🔍</Text>,
          }}>
          {() => <QueryScreen userId={userId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default App;
