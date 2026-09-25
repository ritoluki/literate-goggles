-- Runs against the local demo database only. The transaction is always rolled back.
BEGIN;

DO $checks$
DECLARE
  actual_count integer;
  marker text := gen_random_uuid()::text;
BEGIN
  SELECT count(*) INTO actual_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'commerce_session', 'order_access_grant', 'cart_completion',
      'idempotency_request', 'advisor_preference', 'notification_delivery',
      'operational_setting'
    );
  IF actual_count <> 7 THEN
    RAISE EXCEPTION 'expected seven commerce identity tables, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'IDX_commerce_session_token_hash_unique',
      'IDX_commerce_session_cart_id_unique',
      'IDX_order_access_grant_session_id_order_id_unique',
      'IDX_cart_completion_cart_id_unique',
      'IDX_idempotency_request_session_id_key_operation_unique',
      'IDX_advisor_preference_session_id_unique',
      'IDX_notification_delivery_order_id_template_key_template_version_unique',
      'IDX_operational_setting_key_unique'
    )
    AND indexdef LIKE 'CREATE UNIQUE INDEX%';
  IF actual_count <> 8 THEN
    RAISE EXCEPTION 'expected eight unique indexes, found %', actual_count;
  END IF;

  INSERT INTO commerce_session (id, token_hash, cart_id, expires_at)
  VALUES ('test-' || marker, marker, 'cart-' || marker, now() + interval '1 day');
  BEGIN
    INSERT INTO commerce_session (id, token_hash, expires_at)
    VALUES ('test-duplicate-' || marker, marker, now() + interval '1 day');
    RAISE EXCEPTION 'duplicate token hash was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO idempotency_request
    (id, session_id, key, operation, request_hash, expires_at)
  VALUES
    ('test-' || marker, 'session-' || marker, marker, 'complete-cart',
     marker, now() + interval '1 day');
  BEGIN
    INSERT INTO idempotency_request
      (id, session_id, key, operation, request_hash, expires_at)
    VALUES
      ('test-duplicate-' || marker, 'session-' || marker, marker,
       'complete-cart', marker, now() + interval '1 day');
    RAISE EXCEPTION 'duplicate idempotency intent was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$checks$;

ROLLBACK;
