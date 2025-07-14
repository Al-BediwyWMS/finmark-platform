// src/components/Auth/Login.js
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../../redux/authSlice';

const Login = () => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear validation errors when user types
    if (validationErrors[name]) {
      setValidationErrors({
        ...validationErrors,
        [name]: ''
      });
    }
  };
  
  // Handle input blur (for validation)
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched({
      ...touched,
      [name]: true
    });
    validateField(name, formData[name]);
  };
  
  // Validate a single field
  const validateField = (name, value) => {
    let errors = { ...validationErrors };
    
    switch (name) {
      case 'email':
        if (!value) {
          errors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(value)) {
          errors.email = 'Email is invalid';
        } else {
          errors.email = '';
        }
        break;
        
      case 'password':
        if (!value) {
          errors.password = 'Password is required';
        } else if (value.length < 8) {
          errors.password = 'Password must be at least 8 characters';
        } else {
          errors.password = '';
        }
        break;
        
      default:
        break;
    }
    
    setValidationErrors(errors);
    return !errors[name]; // Return true if field is valid
  };
  
  // Validate all form fields
  const validateForm = () => {
    const { email, password } = formData;
    
    // Mark all fields as touched
    setTouched({
      email: true,
      password: true
    });
    
    // Validate each field
    const isEmailValid = validateField('email', email);
    const isPasswordValid = validateField('password', password);
    
    return isEmailValid && isPasswordValid;
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (validateForm()) {
      dispatch(login(formData));
    }
  };
  
  // Determine if field has error
  const hasError = (field) => {
    return touched[field] && validationErrors[field];
  };
  
  return (
    <div className="login-container">
      <h2>Log In</h2>
      
      {error && (
        <div className="error-message">
          {typeof error === 'string' ? error : 'Login failed. Please check your credentials.'}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className={`form-group ${hasError('email') ? 'has-error' : ''}`}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter your email"
            disabled={loading}
          />
          {hasError('email') && (
            <div className="field-error">{validationErrors.email}</div>
          )}
        </div>
        
        <div className={`form-group ${hasError('password') ? 'has-error' : ''}`}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter your password"
            disabled={loading}
          />
          {hasError('password') && (
            <div className="field-error">{validationErrors.password}</div>
          )}
        </div>
        
        <button 
          type="submit" 
          className="login-button"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </div>
  );
};

export default Login;