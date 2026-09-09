-- RFC-4648 Base32
CREATE OR REPLACE FUNCTION base32_rfc4648_encode(bytes bytea) RETURNS TEXT AS
$$
DECLARE
    bits       BIGINT := 0;
    bit_count  INT    := 0;
    output     TEXT   := '';
    byte_val   INT;
    char_index INT;
    -- RFC 4648 Standard Alphabet
    alphabet   TEXT   := 'abcdefghijklmnopqrstuvwxyz234567';
BEGIN
    IF bytes IS NULL THEN
        RETURN NULL;
    END IF;

    FOR i IN 0..octet_length(bytes) - 1
        LOOP
            byte_val := get_byte(bytes, i);
            bits := (bits << 8) | byte_val;
            bit_count := bit_count + 8;

            WHILE bit_count >= 5
                LOOP
                    char_index := (bits >> (bit_count - 5)) & 31;
                    output := output || substr(alphabet, char_index + 1, 1);
                    bit_count := bit_count - 5;
                END LOOP;
        END LOOP;

    -- Handle any remaining bits
    IF bit_count > 0 THEN
        char_index := (bits << (5 - bit_count)) & 31;
        output := output || substr(alphabet, char_index + 1, 1);
    END IF;

    -- RFC 4648 specifies padding with '=', but f4b6a3's codec for fixed-size
    -- UUIDs expects an unpadded string. 128 bits naturally encode to 26 characters
    -- without needing padding. The length should be correct naturally.
    RETURN output;
END;
$$ LANGUAGE plpgsql IMMUTABLE;



CREATE OR REPLACE FUNCTION generate_uuid_v7_base32() RETURNS TEXT AS
$$
DECLARE
    unix_ts_ms   BIGINT;
    uuid_bytes   bytea;
    random_bytes bytea;
BEGIN
    unix_ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
    random_bytes := uuid_send(uuid_generate_v4());

    uuid_bytes := set_byte(E'\\000\\000\\000\\000\\000\\000\\000\\000\\000\\000\\000\\000\\000\\000\\000\\000', 0,
                           ((unix_ts_ms >> 40) & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 1, ((unix_ts_ms >> 32) & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 2, ((unix_ts_ms >> 24) & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 3, ((unix_ts_ms >> 16) & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 4, ((unix_ts_ms >> 8) & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 5, (unix_ts_ms & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(random_bytes, 6) & 15) | B'01110000'::INT); -- version 7
    uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(random_bytes, 8) & 63) | B'10000000'::INT); -- variant RFC4122
    uuid_bytes := set_byte(uuid_bytes, 7, get_byte(random_bytes, 7));
    FOR i IN 9..15
        LOOP
            uuid_bytes := set_byte(uuid_bytes, i, get_byte(random_bytes, i));
        END LOOP;

    -- Call the correct RFC 4648 encoder
    RETURN base32_rfc4648_encode(uuid_bytes);
END;
$$ LANGUAGE plpgsql VOLATILE;