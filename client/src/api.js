import axios from 'axios';

const API_BASE_URL = '/api';

export const api = {
  // 获取所有活动
  getEvents: () => axios.get(`${API_BASE_URL}/events`),
  
  // 获取单个活动
  getEvent: (id) => axios.get(`${API_BASE_URL}/events/${id}`),
  
  // 创建活动
  createEvent: (data) => axios.post(`${API_BASE_URL}/events`, data),
  
  // 删除活动
  deleteEvent: (id) => axios.delete(`${API_BASE_URL}/events/${id}`),
  
  // 预约活动
  createBooking: (data) => axios.post(`${API_BASE_URL}/bookings`, data),
  
  // 取消预约
  cancelBooking: (id) => axios.delete(`${API_BASE_URL}/bookings/${id}`),
  
  // 获取预约者的预约记录
  getParticipantBookings: (name) => axios.get(`${API_BASE_URL}/bookings/participant/${name}`),
  
  // 获取开团者的活动
  getOrganizerEvents: (name) => axios.get(`${API_BASE_URL}/events/organizer/${name}`),
};
