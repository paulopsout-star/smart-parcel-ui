
-- Operação 1: Corrigir Iago Augusto (cancelled → completed)
UPDATE charges
SET status = 'completed',
    completed_at = '2026-01-08T01:05:34.394+00',
    updated_at = now()
WHERE id = '0a47656b-1764-44d0-bda8-678822ab18ea';

-- Operação 2: Corrigir 12 charges para processing
UPDATE charges
SET status = 'processing',
    updated_at = now()
WHERE id IN (
  '8f36fc38-4dc8-428c-a5fa-2c18fb9ff831',
  'f4aac4a6-3be2-4ab5-8397-781e7d1693f2',
  '569abbe6-0b14-4f48-8489-f645c81768d9',
  '526a9f56-0dc2-475e-a355-ff7b828eedc7',
  'd442b2f3-0d74-41db-885a-74d786e12de9',
  'ff27c6d4-5b53-4045-ad66-0145138ff73f',
  'c97f60c5-fed4-490e-9f84-3945a9b6ce4d',
  'cda831b6-acde-4f4e-9e93-10b899ecbb8a',
  '7df32f8d-0a51-431b-9801-77ad0013f715',
  '18339005-7197-4f40-af28-3c4e84df4e89',
  'aad2b927-6bae-4f16-80e9-cc307b13f154',
  'd67eb497-03ac-412f-a1bb-54d7f1e323cc'
);
