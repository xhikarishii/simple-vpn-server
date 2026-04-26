import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, 
  TextField, MenuItem, Select, FormControl, InputLabel, DialogActions,
  Chip
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

function Users() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    vpn_type: 'wireguard',
    login_password: '',
    role: 'user'
  });

  const fetchUsers = async () => {
    const res = await axios.get('/api/users');
    setUsers(res.data);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    await axios.post('/api/users', newUser);
    setOpen(false);
    setNewUser({ username: '', password: '', vpn_type: 'wireguard', login_password: '', role: 'user' });
    fetchUsers();
  };

  const showConfig = async (id) => {
    const res = await axios.get(`/api/users/${id}/config`);
    setCurrentConfig(res.data);
    setConfigOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete user?')) {
      await axios.delete(`/api/users/${id}`);
      fetchUsers();
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Users</Typography>
        <Button variant="contained" onClick={() => setOpen(true)} sx={{ borderRadius: 2 }}>Add User</Button>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>VPN Type</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell sx={{ fontWeight: 'medium' }}>{user.username}</TableCell>
                <TableCell>
                  <Chip 
                    label={user.role} 
                    size="small" 
                    color={user.role === 'admin' ? 'secondary' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{user.vpn_type ? user.vpn_type.toUpperCase() : 'N/A'}</TableCell>
                <TableCell>{user.ip_address || 'Dynamic'}</TableCell>
                <TableCell align="right">
                  {user.vpn_type === 'wireguard' && (
                    <Button size="small" onClick={() => showConfig(user.id)}>Config</Button>
                  )}
                  <Button size="small" color="error" onClick={() => handleDelete(user.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add User Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 'bold' }}>Add VPN User</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Username" margin="dense"
            value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
          />
          <TextField
            fullWidth label="Dashboard Login Password" margin="dense" type="password"
            helperText="Used to log in to this dashboard"
            value={newUser.login_password} onChange={(e) => setNewUser({ ...newUser, login_password: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Role</InputLabel>
            <Select
              value={newUser.role}
              label="Role"
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>VPN Type</InputLabel>
            <Select
              value={newUser.vpn_type}
              label="VPN Type"
              onChange={(e) => setNewUser({ ...newUser, vpn_type: e.target.value })}
            >
              <MenuItem value="wireguard">WireGuard</MenuItem>
              <MenuItem value="l2tp">L2TP/IPsec</MenuItem>
              <MenuItem value="none">No VPN (Admin Only)</MenuItem>
            </Select>
          </FormControl>
          {newUser.vpn_type === 'l2tp' && (
            <TextField
              fullWidth label="VPN Password" margin="dense" type="password"
              helperText="Password for L2TP connection"
              value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" sx={{ borderRadius: 2 }}>Create User</Button>
        </DialogActions>
      </Dialog>

      {/* Config/QR Dialog */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>WireGuard Configuration</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          {currentConfig && (
            <>
              <Box sx={{ p: 2, bgcolor: 'white', display: 'inline-block', mb: 2, borderRadius: 2 }}>
                <QRCodeSVG value={currentConfig.config} size={256} />
              </Box>
              <pre style={{ 
                textAlign: 'left', 
                background: '#1a1a1a', 
                padding: 15, 
                borderRadius: 8, 
                fontSize: '0.8rem',
                overflowX: 'auto'
              }}>
                {currentConfig.config}
              </pre>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Users;
