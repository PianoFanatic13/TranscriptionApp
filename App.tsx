import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text} from 'react-native';
import RecordScreen from './src/screens/RecordScreen';
import QueryScreen from './src/screens/QueryScreen';

const Tab = createBottomTabNavigator();

const App = () => {
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
