import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, 
  TextField, MenuItem, Select, FormControl, InputLabel, DialogActions 
} from '@mui/material';
import axios from 'axios';

function Networking() {
  const [rules, setRules] = useState([]);
  const [open, setOpen] = useState(false);
  const [newRule, setNewRule] = useState({ 
    external_port: '', internal_ip: '', internal_port: '', protocol: 'tcp', description: '' 
  });

  const fetchRules = async () => {
    const res = await axios.get('/api/rules');
    setRules(res.data);
  };

  useEffect(() => { fetchRules(); }, []);

  const handleCreate = async () => {
    await axios.post('/api/rules', newRule);
    setOpen(false);
    fetchRules();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete rule?')) {
      await axios.delete(`/api/rules/${id}`);
      fetchRules();
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Port Forwarding</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>Add Rule</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell>External Port</TableCell>
              <TableCell>Internal Destination</TableCell>
              <TableCell>Protocol</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.description}</TableCell>
                <TableCell>{rule.external_port}</TableCell>
                <TableCell>{rule.internal_ip}:{rule.internal_port}</TableCell>
                <TableCell>{rule.protocol.toUpperCase()}</TableCell>
                <TableCell>
                  <Button color="error" onClick={() => handleDelete(rule.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Add Port Forwarding Rule</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Description" margin="dense"
            value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
          />
          <TextField
            fullWidth label="External Port" margin="dense" type="number"
            value={newRule.external_port} onChange={(e) => setNewRule({ ...newRule, external_port: e.target.value })}
          />
          <TextField
            fullWidth label="Internal IP (Client VPN IP)" margin="dense"
            value={newRule.internal_ip} onChange={(e) => setNewRule({ ...newRule, internal_ip: e.target.value })}
          />
          <TextField
            fullWidth label="Internal Port" margin="dense" type="number"
            value={newRule.internal_port} onChange={(e) => setNewRule({ ...newRule, internal_port: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Protocol</InputLabel>
            <Select
              value={newRule.protocol}
              onChange={(e) => setNewRule({ ...newRule, protocol: e.target.value })}
            >
              <MenuItem value="tcp">TCP</MenuItem>
              <MenuItem value="udp">UDP</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Networking;
