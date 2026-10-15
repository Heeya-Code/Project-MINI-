// Mock room inventory (NOT TSEC's real room register). Keep it separate from UI
// code so the real register can be dropped in without touching a component.
export const roomTypes = ['Classroom', 'Computer Lab', 'Electronics Lab', 'Seminar Hall']
export const buildings = ['Old Building', 'New Building']

export const rooms = [
  { id: 'C-301', building: 'Old Building', type: 'Classroom', floor: '3rd Floor', capacity: 60 },
  { id: 'C-302', building: 'Old Building', type: 'Classroom', floor: '3rd Floor', capacity: 60 },
  { id: 'C-303', building: 'Old Building', type: 'Classroom', floor: '3rd Floor', capacity: 60 },
  { id: 'C-304', building: 'Old Building', type: 'Classroom', floor: '3rd Floor', capacity: 60 },
  { id: 'C-305', building: 'Old Building', type: 'Classroom', floor: '3rd Floor', capacity: 60 },
  { id: 'C-306', building: 'Old Building', type: 'Classroom', floor: '3rd Floor', capacity: 60 },
  { id: 'C-307', building: 'Old Building', type: 'Classroom', floor: '3rd Floor', capacity: 60 },
  { id: 'CH-101', building: 'Old Building', type: 'Classroom', floor: '1st Floor', capacity: 50 },
  { id: 'N-201', building: 'New Building', type: 'Classroom', floor: '2nd Floor', capacity: 60 },
  { id: 'N-202', building: 'New Building', type: 'Classroom', floor: '2nd Floor', capacity: 60 },
  { id: 'N-203', building: 'New Building', type: 'Classroom', floor: '2nd Floor', capacity: 60 },
  { id: 'N-204', building: 'New Building', type: 'Classroom', floor: '2nd Floor', capacity: 60 },
  { id: 'N-205', building: 'New Building', type: 'Classroom', floor: '2nd Floor', capacity: 60 },
  { id: 'N-206', building: 'New Building', type: 'Classroom', floor: '2nd Floor', capacity: 60 },
  { id: 'C-104', building: 'New Building', type: 'Computer Lab', floor: '1st Floor', capacity: 40 },
  { id: 'C-105', building: 'New Building', type: 'Computer Lab', floor: '1st Floor', capacity: 40 },
  { id: 'IT-201', building: 'Old Building', type: 'Computer Lab', floor: '2nd Floor', capacity: 40 },
  { id: 'IT-202', building: 'Old Building', type: 'Computer Lab', floor: '2nd Floor', capacity: 40 },
  { id: 'AIDS-202', building: 'Old Building', type: 'Computer Lab', floor: '2nd Floor', capacity: 40 },
  { id: 'EXTC-305', building: 'Old Building', type: 'Electronics Lab', floor: '3rd Floor', capacity: 35 },
  { id: 'EXTC-306', building: 'Old Building', type: 'Electronics Lab', floor: '3rd Floor', capacity: 35 },
  { id: 'Seminar Hall 1', building: 'New Building', type: 'Seminar Hall', floor: '3rd Floor', capacity: 150 },
  { id: 'Seminar Hall 2', building: 'New Building', type: 'Seminar Hall', floor: '4th Floor', capacity: 120 },
  { id: 'Seminar Hall 3', building: 'Old Building', type: 'Seminar Hall', floor: '1st Floor', capacity: 100 },
]
