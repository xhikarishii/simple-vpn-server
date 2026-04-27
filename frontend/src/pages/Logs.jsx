import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  TextField, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel, 
  Stack,
  Chip,
  Card,
  CardContent,
  IconButton,
  Button,
  Grid,
  TablePagination,
  CircularProgress
} from '@mui/material';
import {
  History,
  Search,
  FilterList,
  Security,
  Public,
  Info
} from '@mui/icons-material';
import axios from 'axios';

function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [filters, setFilters] = useState({
    start: '',
    end: '',
    type: 'all'
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.start) params.append('start', filters.start);
      if (filters.end) params.append('end', filters.end);
      if (filters.type !== 'all') params.append('type', filters.type);
      params.append('page', page + 1);
      params.append('limit', rowsPerPage);

      const res = await axios.get(`/api/logs?${params.toString()}`);
      
      // Handle the new structured response { total, logs }
      if (res.data && res.data.logs) {
        setLogs(res.data.logs);
        setTotal(res.data.total);
      } else {
        setLogs([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterSubmit = () => {
    setPage(0); // Reset to first page on new filter
    fetchLogs();
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'dns_block': return <Security fontSize="small" />;
      case 'ip_block': return <Public fontSize="small" />;
      default: return <Info fontSize="small" />;
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'dns_block': return 'warning';
      case 'ip_block': return 'error';
      default: return 'info';
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>System Logs</Typography>
        <Typography color="text.secondary">Monitor blocked attempts and security events</Typography>
      </Box>

      <Card sx={{ mb: 4, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Start Time"
                type="datetime-local"
                variant="filled"
                InputLabelProps={{ shrink: true }}
                value={filters.start}
                onChange={(e) => setFilters({ ...filters, start: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="End Time"
                type="datetime-local"
                variant="filled"
                InputLabelProps={{ shrink: true }}
                value={filters.end}
                onChange={(e) => setFilters({ ...filters, end: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth variant="filled">
                <InputLabel>Event Type</InputLabel>
                <Select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                >
                  <MenuItem value="all">All Events</MenuItem>
                  <MenuItem value="dns_block">DNS Blocks</MenuItem>
                  <MenuItem value="ip_block">IP Blocks</MenuItem>
                  <MenuItem value="info">System Info</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button 
                fullWidth 
                variant="contained" 
                startIcon={<Search />} 
                onClick={handleFilterSubmit}
                sx={{ height: 56, borderRadius: 2 }}
              >
                Filter Logs
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'transparent', position: 'relative' }}>
        {loading && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.1)', zIndex: 1 }}>
            <CircularProgress size={30} />
          </Box>
        )}
        <Table>
          <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Event Type</TableCell>
              <TableCell>Source IP</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length > 0 ? logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Chip 
                    icon={getLogIcon(log.type)}
                    label={log.type.replace('_', ' ').toUpperCase()} 
                    size="small" 
                    color={getLogColor(log.type)} 
                    variant="outlined" 
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{log.source_ip || '-'}</TableCell>
                <TableCell>{log.details}</TableCell>
              </TableRow>
            )) : !loading && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                  <Typography color="text.secondary">No logs found for the selected period.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100, 250]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        />
      </TableContainer>
    </Box>
  );
}

export default Logs;
