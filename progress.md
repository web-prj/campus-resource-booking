# Campus Resource Booking — MVP Progress

Use this file to track feature completion. Plan implementation details separately when starting each item.

## Completed foundation

- [x] Landing page
- [x] Student registration
- [x] Login and logout
- [x] Cookie-based authenticated sessions
- [x] Role-based backend authorization foundation
- [x] Protected frontend routes
- [x] Student dashboard interface
- [x] Backend health endpoint and API documentation
- [x] PostgreSQL migrations and Docker development stack
- [x] Automated frontend, backend, end-to-end, and security checks

## MVP features — build in this order

### 1. Resource catalog

- [x] Resource data model
- [x] Buildings and locations
- [x] Resource types: rooms, laboratories, and equipment
- [x] Capacity, amenities, and resource details
- [x] Resource active and maintenance status
- [x] Initial resource data

### 2. Admin resource management

- [x] Admin resource list
- [x] Create resource
- [x] Edit resource
- [x] Activate or deactivate resource
- [x] Mark resource as under maintenance

### 3. Resource discovery

- [x] Student resource directory
- [x] Resource search
- [x] Filter by building
- [x] Filter by resource type
- [x] Filter by capacity
- [x] Filter by amenities or equipment
- [x] Resource detail page
- [x] Pagination and sorting

### 4. Availability

- [x] Resource operating hours
- [x] Date and time selection
- [x] Available time-slot display
- [x] Maintenance and closure blocking
- [x] Approval-required resource setting
- [x] Availability API

### 5. Booking requests

- [x] Create booking request
- [x] Prevent invalid time ranges
- [x] Prevent bookings in the past
- [x] Prevent overlapping bookings
- [x] Handle concurrent booking attempts safely
- [x] Confirm bookings that do not require approval
- [x] Set approval-required bookings to pending

### 6. Student booking management

- [ ] Upcoming bookings
- [ ] Pending booking requests
- [ ] Booking details
- [ ] Booking history
- [ ] Cancel eligible booking
- [ ] Display booking status clearly

### 7. Staff approval workflow

- [ ] Staff dashboard
- [ ] Pending approval queue
- [ ] Approve booking request
- [ ] Reject booking request with a reason
- [ ] View resource schedule
- [ ] View booking details

### 8. Check-in and check-out

- [ ] Generate a booking check-in code
- [ ] Student check-in
- [ ] Staff check-in confirmation
- [ ] Staff check-out confirmation
- [ ] Track no-show and completed status
- [ ] Prevent invalid or repeated check-in

### 9. Live dashboard data

- [ ] Connect student dashboard to resource data
- [ ] Connect student dashboard to availability data
- [ ] Connect student dashboard to booking data
- [ ] Remove preview labels when data is live
- [ ] Add staff dashboard summaries
- [ ] Add admin dashboard summaries

### 10. User and role management

- [ ] Admin user list
- [ ] Search users
- [ ] Assign staff and admin roles
- [ ] Activate or deactivate users
- [ ] Protect role-management actions

### 11. Basic analytics

- [ ] Total booking count
- [ ] Booking status breakdown
- [ ] Cancellation rate
- [ ] Most-booked resources
- [ ] Peak booking hours
- [ ] Resource utilization summary
- [ ] Date-range filtering

### 12. MVP user experience

- [ ] Loading states for all live features
- [ ] Empty states for all live features
- [ ] User-friendly error states
- [ ] Accessible forms and status messages
- [ ] Responsive student, staff, and admin workflows
- [ ] Consistent navigation for each role
- [ ] Honest labels for live and unavailable data

## MVP verification and release readiness

- [ ] Complete student flow: register, search, book, check in, and view history
- [ ] Complete staff flow: review, approve or reject, check in, and check out
- [ ] Complete admin flow: manage resources, users, and basic analytics
- [ ] Verify overlapping bookings cannot be created
- [ ] Verify concurrent requests allow only one booking for a slot
- [ ] Verify authentication and authorization across every role
- [ ] Add backend unit and end-to-end coverage for new features
- [ ] Add frontend component and route coverage for new features
- [ ] Run full frontend and backend validation
- [ ] Run desktop and mobile smoke tests
- [ ] Review API documentation
- [ ] Review migrations and database indexes
- [ ] Prepare demo data
- [ ] Prepare MVP deployment configuration
- [ ] Complete final MVP smoke test

## Post-MVP enhancements

- [ ] Email or in-app notifications
- [ ] QR-code check-in
- [ ] Real-time availability updates
- [ ] Redis caching
- [ ] Availability-query optimization benchmarks
- [ ] Load and stress testing
- [ ] Performance comparison report
- [ ] Advanced analytics and exports
- [ ] Recurring bookings
- [ ] Waitlists
- [ ] Calendar integration
