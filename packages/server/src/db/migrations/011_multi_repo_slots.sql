-- Allow each repo to have its own slot-1 through slot-N
-- Previously slot_number was globally unique, which blocked multi-repo mode
ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_slot_number_key;
ALTER TABLE slots ADD CONSTRAINT slots_slot_number_repo_unique UNIQUE (slot_number, repo_id);
