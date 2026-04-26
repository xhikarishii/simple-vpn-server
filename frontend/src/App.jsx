import React, { useState, useEffect } from 'react';
import { 
  createTheme, 
  ThemeProvider, 
  CssBaseline, 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Typography, 
  AppBar, 
  Toolbar, 
  IconButton,
  Button
} from '@mui/material';
import { 
  Dashboard as DashboardIcon, 
  People, 
  Router, 
  Settings, 
  ExitToApp, 
  VpnKey 
} from '@mui/icons-material';
import { BrowserRouter as RouterDom, Routes, Route, Link, Navigate } from 'react-router-dom';
import axios from 'axios';

import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Networking from './pages/Networking';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import MyConfig from './pages/MyConfig';

const drawerWidth = 240;

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3f51b5' },
    secondary: { main: '#f50057' },
    background: { default: '#0a1929', paper: '#102030' },
  },
  typography: {
    fontFamily: '"Outfit", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const username = localStorage.getItem('username');

    if (token) {
      setUser({ token, role, username });
      // Configure global axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const handleLogin = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('username', data.username);
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) return null;

  if (!user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  const menuItems = user.role === 'admin' ? [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Users', icon: <People />, path: '/users' },
    { text: 'Networking', icon: <Router />, path: '/networking' },
    { text: 'Settings', icon: <Settings />, path: '/settings' },
  ] : [
    { text: 'My Connection', icon: <VpnKey />, path: '/my-config' },
  ];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterDom>
        <Box sx={{ display: 'flex' }}>
          <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <Toolbar sx={{ justifyContent: 'space-between' }}>
              <Typography variant="h6" noWrap component="div">
                VPN Control
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ mr: 2, color: 'text.secondary' }}>
                  Logged in as <strong>{user.username}</strong> ({user.role})
                </Typography>
                <IconButton color="inherit" onClick={handleLogout}>
                  <ExitToApp />
                </IconButton>
              </Box>
            </Toolbar>
          </AppBar>
          <Drawer
            variant="permanent"
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
            }}
          >
            <Toolbar />
            <Box sx={{ overflow: 'auto' }}>
              <List>
                {menuItems.map((item) => (
                  <ListItem button key={item.text} component={Link} to={item.path}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Drawer>
          <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
            <Toolbar />
            <Routes>
              {user.role === 'admin' ? (
                <>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/networking" element={<Networking />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              ) : (
                <>
                  <Route path="/my-config" element={<MyConfig />} />
                  <Route path="*" element={<Navigate to="/my-config" replace />} />
                </>
              )}
            </Routes>
          </Box>
        </Box>
      </RouterDom>
    </ThemeProvider>
  );
}

export default App;
