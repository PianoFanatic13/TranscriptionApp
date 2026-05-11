import React, {useEffect, useState} from 'react';
import {ActivityIndicator, LogBox, StyleSheet, View} from 'react-native';

LogBox.ignoreLogs(['new NativeEventEmitter']);
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import RecordScreen from './src/screens/RecordScreen';
import QueryScreen from './src/screens/QueryScreen';
import NotesScreen from './src/screens/NotesScreen';
import LoginScreen from './src/screens/LoginScreen';

const DEVICE_USER_ID_KEY = 'device_user_id';

const Tab = createBottomTabNavigator();

const MicTabIcon = ({color}: {color: string}) => (
  <View style={styles.micIcon}>
    <View style={[styles.micCapsule, {borderColor: color}]} />
    <View style={[styles.micArm, {backgroundColor: color}]} />
    <View style={[styles.micPole, {backgroundColor: color}]} />
    <View style={[styles.micBase, {backgroundColor: color}]} />
  </View>
);

const SearchTabIcon = ({color}: {color: string}) => (
  <View style={styles.searchIcon}>
    <View style={[styles.searchCircle, {borderColor: color}]} />
    <View style={[styles.searchHandle, {backgroundColor: color}]} />
  </View>
);

const NotesTabIcon = ({color}: {color: string}) => (
  <View style={styles.notesIcon}>
    <View style={[styles.notesLine, {backgroundColor: color}]} />
    <View style={[styles.notesLine, styles.notesLineMid, {backgroundColor: color}]} />
    <View style={[styles.notesLine, {backgroundColor: color}]} />
  </View>
);

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
      <View style={styles.loader}>
        <ActivityIndicator color="#2d6a4f" size="large" />
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
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#2d6a4f',
          tabBarInactiveTintColor: '#8a8a84',
        }}>
        <Tab.Screen
          name="Record"
          component={RecordScreen}
          options={{
            tabBarLabel: 'Record',
            tabBarIcon: ({color}) => <MicTabIcon color={color} />,
          }}
        />
        <Tab.Screen
          name="Notes"
          component={NotesScreen}
          options={{
            tabBarLabel: 'Notes',
            tabBarIcon: ({color}) => <NotesTabIcon color={color} />,
          }}
        />
        <Tab.Screen
          name="Query"
          component={QueryScreen}
          options={{
            tabBarLabel: 'Search',
            tabBarIcon: ({color}) => <SearchTabIcon color={color} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#f7f5f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingBottom: 4,
  },
  // Mic icon
  micIcon: {width: 20, height: 22, alignItems: 'center'},
  micCapsule: {
    width: 8,
    height: 12,
    borderRadius: 4,
    borderWidth: 2,
    marginBottom: 2,
  },
  micArm: {width: 14, height: 1.5, marginBottom: 1},
  micPole: {width: 1.5, height: 4},
  micBase: {width: 8, height: 1.5},
  // Notes icon
  notesIcon: {width: 20, height: 18, justifyContent: 'space-between'},
  notesLine: {height: 2, borderRadius: 1, width: 20},
  notesLineMid: {width: 14},
  // Search icon
  searchIcon: {width: 20, height: 20},
  searchCircle: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  searchHandle: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 2,
    height: 7,
    borderRadius: 1,
    transform: [{rotate: '45deg'}],
  },
});

export default App;
