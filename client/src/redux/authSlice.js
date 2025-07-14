// src/redux/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Base URL for API requests
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/auth';

// Create async thunks for authentication
export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      // Validate input before making API call
      if (!credentials.email || !credentials.password) {
        return rejectWithValue({
          message: 'Email and password are required',
          details: {
            email: !credentials.email ? 'Email is required' : undefined,
            password: !credentials.password ? 'Password is required' : undefined
          }
        });
      }
      
      const response = await axios.post(`${API_URL}/login`, credentials);
      
      // Store token in localStorage
      localStorage.setItem('token', response.data.token);
      
      return response.data;
    } catch (error) {
      // Handle different types of errors
      if (error.response) {
        // The server responded with an error status
        return rejectWithValue({
          message: error.response.data.message || 'Authentication failed',
          status: error.response.status,
          details: error.response.data.details
        });
      } else if (error.request) {
        // The request was made but no response was received
        return rejectWithValue({
          message: 'No response from server. Please check your internet connection.',
          networkError: true
        });
      } else {
        // Something else happened in setting up the request
        return rejectWithValue({
          message: error.message || 'An unexpected error occurred',
          unexpectedError: true
        });
      }
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      // Validate input before making API call
      const { email, password, name } = userData;
      const errors = {};
      
      if (!email) errors.email = 'Email is required';
      if (!password) errors.password = 'Password is required';
      if (!name) errors.name = 'Name is required';
      
      if (Object.keys(errors).length > 0) {
        return rejectWithValue({
          message: 'Please fill all required fields',
          details: errors
        });
      }
      
      const response = await axios.post(`${API_URL}/register`, userData);
      
      // Store token in localStorage
      localStorage.setItem('token', response.data.token);
      
      return response.data;
    } catch (error) {
      if (error.response) {
        return rejectWithValue({
          message: error.response.data.message || 'Registration failed',
          status: error.response.status,
          details: error.response.data.details
        });
      } else if (error.request) {
        return rejectWithValue({
          message: 'No response from server. Please check your internet connection.',
          networkError: true
        });
      } else {
        return rejectWithValue({
          message: error.message || 'An unexpected error occurred',
          unexpectedError: true
        });
      }
    }
  }
);

// Thunk to load user profile with token
export const loadUser = createAsyncThunk(
  'auth/loadUser',
  async (_, { rejectWithValue, getState }) => {
    try {
      // Get token from state or localStorage
      const token = getState().auth.token || localStorage.getItem('token');
      
      if (!token) {
        return rejectWithValue('No authentication token found');
      }
      
      // Set auth header
      const config = {
        headers: {
          'x-auth-token': token
        }
      };
      
      const response = await axios.get(`${API_URL}/profile`, config);
      return response.data;
    } catch (error) {
      if (error.response) {
        // Handle token expiration
        if (error.response.status === 401) {
          localStorage.removeItem('token');
        }
        
        return rejectWithValue({
          message: error.response.data.message || 'Failed to load user profile',
          status: error.response.status
        });
      } else if (error.request) {
        return rejectWithValue('No response from server');
      } else {
        return rejectWithValue(error.message || 'An unexpected error occurred');
      }
    }
  }
);

// Logout action
export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    // Remove token from localStorage
    localStorage.removeItem('token');
    return null;
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    user: null,
    loading: false,
    error: null,
    validationErrors: {}
  },
  reducers: {
    clearErrors: (state) => {
      state.error = null;
      state.validationErrors = {};
    }
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.validationErrors = {};
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
        
        // Handle validation errors
        if (action.payload && action.payload.details) {
          state.validationErrors = action.payload.details;
          state.error = action.payload.message;
        } else {
          state.error = action.payload ? action.payload.message : 'Login failed';
        }
      })
      
      // Register cases
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.validationErrors = {};
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        
        // Handle validation errors
        if (action.payload && action.payload.details) {
          state.validationErrors = action.payload.details;
          state.error = action.payload.message;
        } else {
          state.error = action.payload ? action.payload.message : 'Registration failed';
        }
      })
      
      // Load user cases
      .addCase(loadUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
      })
      .addCase(loadUser.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
        state.error = action.payload ? 
          (typeof action.payload === 'string' ? action.payload : action.payload.message) 
          : 'Failed to load user';
      })
      
      // Logout case
      .addCase(logout.fulfilled, (state) => {
        state.token = null;
        state.isAuthenticated = false;
        state.user = null;
        state.loading = false;
      });
  }
});

export const { clearErrors } = authSlice.actions;
export default authSlice.reducer;