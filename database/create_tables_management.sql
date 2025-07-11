-- Table Management Schema for TooHot Restaurant
-- This creates a comprehensive table management system similar to Resy

-- Table for individual table configuration
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number VARCHAR(10) NOT NULL UNIQUE,
    table_name VARCHAR(50),
    capacity INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 20),
    table_type VARCHAR(20) NOT NULL CHECK (table_type IN ('omakase', 'dining', 'both')),
    shape VARCHAR(20) NOT NULL DEFAULT 'rectangular' CHECK (shape IN ('rectangular', 'round', 'square')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    min_party_size INTEGER DEFAULT 1 CHECK (min_party_size > 0),
    max_party_size INTEGER CHECK (max_party_size <= capacity),
    section VARCHAR(50), -- e.g., 'main-dining', 'bar', 'private-room'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for floor plan positions and visual layout
CREATE TABLE IF NOT EXISTS restaurant_floor_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    x_position INTEGER NOT NULL DEFAULT 0,
    y_position INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 80,
    height INTEGER NOT NULL DEFAULT 60,
    rotation INTEGER NOT NULL DEFAULT 0 CHECK (rotation >= 0 AND rotation < 360),
    floor_section VARCHAR(50) NOT NULL DEFAULT 'main',
    z_index INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(table_id, floor_section)
);

-- Table for floor plan sections/areas
CREATE TABLE IF NOT EXISTS restaurant_floor_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_name VARCHAR(50) NOT NULL UNIQUE,
    section_display_name VARCHAR(100),
    background_color VARCHAR(7) DEFAULT '#f8f9fa',
    width INTEGER NOT NULL DEFAULT 800,
    height INTEGER NOT NULL DEFAULT 600,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for table reservations (linking reservations to specific tables)
CREATE TABLE IF NOT EXISTS table_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    reservation_type VARCHAR(20) NOT NULL CHECK (reservation_type IN ('omakase', 'dining')),
    reservation_id UUID NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'seated', 'completed', 'cancelled')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure we don't double-book tables
    UNIQUE(table_id, reservation_date, reservation_time, status) DEFERRABLE INITIALLY DEFERRED
);

-- Insert default floor section
INSERT INTO restaurant_floor_sections (section_name, section_display_name, width, height, sort_order) 
VALUES 
    ('main', 'Main Dining Room', 1000, 700, 1),
    ('bar', 'Bar Area', 600, 400, 2),
    ('private', 'Private Dining', 500, 400, 3)
ON CONFLICT (section_name) DO NOTHING;

-- Insert default tables based on current capacity settings
-- These can be customized later via the admin interface
INSERT INTO restaurant_tables (table_number, table_name, capacity, table_type, shape, section, max_party_size) 
VALUES 
    -- Omakase tables (typically smaller, more intimate)
    ('O1', 'Omakase Counter 1', 2, 'omakase', 'rectangular', 'main-dining', 2),
    ('O2', 'Omakase Counter 2', 2, 'omakase', 'rectangular', 'main-dining', 2),
    ('O3', 'Omakase Counter 3', 2, 'omakase', 'rectangular', 'main-dining', 2),
    ('O4', 'Omakase Counter 4', 2, 'omakase', 'rectangular', 'main-dining', 2),
    ('O5', 'Omakase Counter 5', 2, 'omakase', 'rectangular', 'main-dining', 2),
    ('O6', 'Omakase Counter 6', 2, 'omakase', 'rectangular', 'main-dining', 2),
    
    -- Dining tables (various sizes)
    ('D1', 'Table 1', 2, 'dining', 'round', 'main-dining', 2),
    ('D2', 'Table 2', 2, 'dining', 'round', 'main-dining', 2),
    ('D3', 'Table 3', 4, 'dining', 'rectangular', 'main-dining', 4),
    ('D4', 'Table 4', 4, 'dining', 'rectangular', 'main-dining', 4),
    ('D5', 'Table 5', 6, 'dining', 'rectangular', 'main-dining', 6),
    ('D6', 'Table 6', 6, 'dining', 'rectangular', 'main-dining', 6),
    ('D7', 'Table 7', 8, 'dining', 'rectangular', 'main-dining', 8),
    ('D8', 'Table 8', 2, 'dining', 'round', 'main-dining', 2),
    
    -- Bar seating
    ('B1', 'Bar 1', 2, 'dining', 'rectangular', 'bar', 2),
    ('B2', 'Bar 2', 2, 'dining', 'rectangular', 'bar', 2),
    ('B3', 'Bar 3', 2, 'dining', 'rectangular', 'bar', 2),
    ('B4', 'Bar 4', 2, 'dining', 'rectangular', 'bar', 2)
ON CONFLICT (table_number) DO NOTHING;

-- Insert default floor plan positions
INSERT INTO restaurant_floor_plan (table_id, x_position, y_position, width, height, floor_section)
SELECT 
    rt.id,
    -- Arrange omakase tables in a row
    CASE 
        WHEN rt.table_number LIKE 'O%' THEN 50 + (CAST(SUBSTRING(rt.table_number, 2) AS INTEGER) - 1) * 120
        WHEN rt.table_number LIKE 'D%' THEN 
            CASE 
                WHEN CAST(SUBSTRING(rt.table_number, 2) AS INTEGER) <= 4 THEN 300 + ((CAST(SUBSTRING(rt.table_number, 2) AS INTEGER) - 1) % 2) * 200
                ELSE 500 + ((CAST(SUBSTRING(rt.table_number, 2) AS INTEGER) - 5) % 2) * 250
            END
        WHEN rt.table_number LIKE 'B%' THEN 50 + (CAST(SUBSTRING(rt.table_number, 2) AS INTEGER) - 1) * 120
        ELSE 100
    END as x_pos,
    CASE 
        WHEN rt.table_number LIKE 'O%' THEN 50
        WHEN rt.table_number LIKE 'D%' THEN 
            CASE 
                WHEN CAST(SUBSTRING(rt.table_number, 2) AS INTEGER) <= 2 THEN 200
                WHEN CAST(SUBSTRING(rt.table_number, 2) AS INTEGER) <= 4 THEN 250
                WHEN CAST(SUBSTRING(rt.table_number, 2) AS INTEGER) <= 6 THEN 350
                ELSE 400
            END
        WHEN rt.table_number LIKE 'B%' THEN 50
        ELSE 200
    END as y_pos,
    CASE 
        WHEN rt.capacity <= 2 THEN 80
        WHEN rt.capacity <= 4 THEN 100
        WHEN rt.capacity <= 6 THEN 120
        ELSE 140
    END as width,
    CASE 
        WHEN rt.capacity <= 2 THEN 60
        WHEN rt.capacity <= 4 THEN 80
        WHEN rt.capacity <= 6 THEN 100
        ELSE 120
    END as height,
    CASE 
        WHEN rt.section = 'bar' THEN 'bar'
        WHEN rt.section = 'private-room' THEN 'private'
        ELSE 'main'
    END as floor_section
FROM restaurant_tables rt
WHERE NOT EXISTS (
    SELECT 1 FROM restaurant_floor_plan rfp WHERE rfp.table_id = rt.id
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_type ON restaurant_tables(table_type);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON restaurant_tables(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_section ON restaurant_tables(section);
CREATE INDEX IF NOT EXISTS idx_floor_plan_table_id ON restaurant_floor_plan(table_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_section ON restaurant_floor_plan(floor_section);
CREATE INDEX IF NOT EXISTS idx_table_reservations_table_date ON table_reservations(table_id, reservation_date);
CREATE INDEX IF NOT EXISTS idx_table_reservations_date_time ON table_reservations(reservation_date, reservation_time);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_restaurant_tables_updated_at 
    BEFORE UPDATE ON restaurant_tables 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_floor_plan_updated_at 
    BEFORE UPDATE ON restaurant_floor_plan 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_floor_sections_updated_at 
    BEFORE UPDATE ON restaurant_floor_sections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_table_reservations_updated_at 
    BEFORE UPDATE ON table_reservations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for easier querying
CREATE OR REPLACE VIEW table_layout_view AS
SELECT 
    rt.id,
    rt.table_number,
    rt.table_name,
    rt.capacity,
    rt.table_type,
    rt.shape,
    rt.status,
    rt.section,
    rt.min_party_size,
    rt.max_party_size,
    rt.notes,
    rfp.x_position,
    rfp.y_position,
    rfp.width,
    rfp.height,
    rfp.rotation,
    rfp.floor_section,
    rfp.z_index,
    rfs.section_display_name,
    rfs.background_color
FROM restaurant_tables rt
LEFT JOIN restaurant_floor_plan rfp ON rt.id = rfp.table_id
LEFT JOIN restaurant_floor_sections rfs ON rfp.floor_section = rfs.section_name
WHERE rt.status = 'active';

-- View for table availability
CREATE OR REPLACE VIEW table_availability_view AS
SELECT 
    rt.id,
    rt.table_number,
    rt.table_name,
    rt.capacity,
    rt.table_type,
    rt.status,
    COALESCE(tr.reservation_count, 0) as current_reservations,
    CASE 
        WHEN rt.status != 'active' THEN 'unavailable'
        WHEN COALESCE(tr.reservation_count, 0) > 0 THEN 'reserved'
        ELSE 'available'
    END as availability_status
FROM restaurant_tables rt
LEFT JOIN (
    SELECT 
        table_id,
        COUNT(*) as reservation_count
    FROM table_reservations 
    WHERE reservation_date = CURRENT_DATE 
    AND status IN ('assigned', 'seated')
    GROUP BY table_id
) tr ON rt.id = tr.table_id;

-- Comments for documentation
COMMENT ON TABLE restaurant_tables IS 'Individual table configuration with capacity, type, and attributes';
COMMENT ON TABLE restaurant_floor_plan IS 'Visual positioning and layout information for tables on floor plan';
COMMENT ON TABLE restaurant_floor_sections IS 'Different sections/areas of the restaurant floor plan';
COMMENT ON TABLE table_reservations IS 'Links reservations to specific tables for table-level management';
COMMENT ON VIEW table_layout_view IS 'Combined view of table configuration and floor plan layout';
COMMENT ON VIEW table_availability_view IS 'Real-time table availability status'; 