-- Template item order can intentionally include the same question more than once.
-- The legacy template_questions table remains one-row-per-question for compatibility.

DROP INDEX IF EXISTS public.idx_creator_template_items_template_question;
