import React from 'react';
import { createTheme, ThemeProvider, CssBaseline, Box, Drawer, List, ListItem, ListItemIcon, ListItemText, Typography, AppBar, Toolbar } from '@mui/material';
import { Dashboard as DashboardIcon, People, Router, Settings } from '@mui/icons-material';
import { BrowserRouter as RouterDom, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Networking from './pages/Networking';
import SettingsPage from './pages/Settings';

const drawerWidth = 240;

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#0a1929',
      paper: '#102030',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterDom>
        <Box sx={{ display: 'flex' }}>
          <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <Toolbar>
              <Typography variant="h6" noWrap component="div">
                Antigravity VPN Control
              </Typography>
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
                {[
                  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
                  { text: 'Users', icon: <People />, path: '/users' },
                  { text: 'Networking', icon: <Router />, path: '/networking' },
                  { text: 'Settings', icon: <Settings />, path: '/settings' },
                ].map((item) => (
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
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/networking" element={<Networking />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Box>
        </Box>
      </RouterDom>
    </ThemeProvider>
  );
}

export default App;
