-- Add table_id column to dining_reservations table for table assignment functionality
-- This allows reservations to be assigned to specific tables

ALTER TABLE dining_reservations 
ADD COLUMN table_id UUID REFERENCES restaurant_tables(id);

-- Create index for better performance when querying reservations by table
CREATE INDEX idx_dining_reservations_table_id ON dining_reservations(table_id);

-- Create index for better performance when querying reservations by date and table
CREATE INDEX idx_dining_reservations_date_table ON dining_reservations(reservation_date, table_id);

-- Add comments for documentation
COMMENT ON COLUMN dining_reservations.table_id IS 'Reference to assigned table from restaurant_tables';
COMMENT ON INDEX idx_dining_reservations_table_id IS 'Index for efficient table assignment queries';
COMMENT ON INDEX idx_dining_reservations_date_table IS 'Index for efficient date and table filtering'; 