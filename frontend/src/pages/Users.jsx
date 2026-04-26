import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, 
  TextField, MenuItem, Select, FormControl, InputLabel, DialogActions 
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

function Users() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', vpn_type: 'wireguard' });

  const fetchUsers = async () => {
    const res = await axios.get('/api/users');
    setUsers(res.data);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    await axios.post('/api/users', newUser);
    setOpen(false);
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
        <Typography variant="h4">Users</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>Add User</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.vpn_type.toUpperCase()}</TableCell>
                <TableCell>{user.ip_address || 'Dynamic'}</TableCell>
                <TableCell>
                  {user.vpn_type === 'wireguard' && (
                    <Button onClick={() => showConfig(user.id)}>Config</Button>
                  )}
                  <Button color="error" onClick={() => handleDelete(user.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add User Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Add VPN User</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Username" margin="dense"
            value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>VPN Type</InputLabel>
            <Select
              value={newUser.vpn_type}
              onChange={(e) => setNewUser({ ...newUser, vpn_type: e.target.value })}
            >
              <MenuItem value="wireguard">WireGuard</MenuItem>
              <MenuItem value="l2tp">L2TP/IPsec</MenuItem>
            </Select>
          </FormControl>
          {newUser.vpn_type === 'l2tp' && (
            <TextField
              fullWidth label="Password" margin="dense" type="password"
              value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Config/QR Dialog */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)}>
        <DialogTitle>WireGuard Configuration</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          {currentConfig && (
            <>
              <Box sx={{ p: 2, bgcolor: 'white', display: 'inline-block', mb: 2 }}>
                <QRCodeSVG value={currentConfig.config} size={256} />
              </Box>
              <pre style={{ textAlign: 'left', background: '#222', padding: 10, borderRadius: 5 }}>
                {currentConfig.config}
              </pre>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default Users;
