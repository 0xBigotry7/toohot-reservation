-- TooHot Reservation System - Production Database Indexes
-- Run these after deploying to production for optimal performance

-- =======================
-- OMAKASE RESERVATIONS
-- =======================

-- Primary performance indexes
CREATE INDEX IF NOT EXISTS idx_omakase_reservations_date 
ON omakase_reservations(reservation_date);

CREATE INDEX IF NOT EXISTS idx_omakase_reservations_status 
ON omakase_reservations(status);

CREATE INDEX IF NOT EXISTS idx_omakase_reservations_created_at 
ON omakase_reservations(created_at DESC);

-- Contact information lookup indexes
CREATE INDEX IF NOT EXISTS idx_omakase_reservations_email 
ON omakase_reservations(customer_email) 
WHERE customer_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_omakase_reservations_phone 
ON omakase_reservations(customer_phone) 
WHERE customer_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_omakase_reservations_confirmation_code 
ON omakase_reservations(confirmation_code);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_omakase_reservations_date_status 
ON omakase_reservations(reservation_date, status);

CREATE INDEX IF NOT EXISTS idx_omakase_reservations_date_time 
ON omakase_reservations(reservation_date, reservation_time);

-- Analytics and reporting indexes
CREATE INDEX IF NOT EXISTS idx_omakase_reservations_analytics 
ON omakase_reservations(created_at, status, party_size) 
WHERE status != 'cancelled';

-- =======================
-- DINING RESERVATIONS  
-- =======================

-- Primary performance indexes
CREATE INDEX IF NOT EXISTS idx_dining_reservations_date 
ON dining_reservations(reservation_date);

CREATE INDEX IF NOT EXISTS idx_dining_reservations_status 
ON dining_reservations(status);

CREATE INDEX IF NOT EXISTS idx_dining_reservations_created_at 
ON dining_reservations(created_at DESC);

-- Contact information lookup indexes
CREATE INDEX IF NOT EXISTS idx_dining_reservations_email 
ON dining_reservations(customer_email) 
WHERE customer_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dining_reservations_phone 
ON dining_reservations(customer_phone) 
WHERE customer_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dining_reservations_confirmation_code 
ON dining_reservations(confirmation_code);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dining_reservations_date_status 
ON dining_reservations(reservation_date, status);

CREATE INDEX IF NOT EXISTS idx_dining_reservations_date_time 
ON dining_reservations(reservation_date, reservation_time);

-- Analytics and reporting indexes
CREATE INDEX IF NOT EXISTS idx_dining_reservations_analytics 
ON dining_reservations(created_at, status, party_size) 
WHERE status != 'cancelled';

-- =======================
-- ADMIN SETTINGS
-- =======================

-- Primary key already provides index for setting_key
-- Additional index for updated_at for audit trails
CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_at 
ON admin_settings(updated_at DESC);

-- =======================
-- PERFORMANCE STATISTICS
-- =======================

-- Update table statistics for query planner
ANALYZE omakase_reservations;
ANALYZE dining_reservations;
ANALYZE admin_settings;

-- =======================
-- MONITORING QUERIES
-- =======================

-- View to monitor index usage (run periodically)
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  CASE 
    WHEN idx_tup_read = 0 THEN 0
    ELSE (idx_tup_fetch::float / idx_tup_read::float * 100)::int
  END as efficiency_percentage
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_tup_read DESC;

-- Query to identify slow queries (for monitoring)
-- Note: This requires pg_stat_statements extension
-- Enable with: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

COMMENT ON VIEW index_usage_stats IS 
'Monitor index efficiency - run SELECT * FROM index_usage_stats; periodically';

-- =======================
-- PRODUCTION NOTES
-- =======================

/*
Performance Recommendations:

1. Monitor index usage with:
   SELECT * FROM index_usage_stats;

2. Watch for slow queries:
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   WHERE query LIKE '%reservations%' 
   ORDER BY mean_time DESC LIMIT 10;

3. Update statistics regularly:
   ANALYZE omakase_reservations;
   ANALYZE dining_reservations;

4. Monitor database size:
   SELECT 
     pg_size_pretty(pg_total_relation_size('omakase_reservations')) as omakase_size,
     pg_size_pretty(pg_total_relation_size('dining_reservations')) as dining_size;

5. Consider partitioning tables by month if volume exceeds 100k records:
   -- Future optimization for high-volume scenarios
*/ 