import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  archiveQuestion,
  createAssessmentInviteLink,
  createAssessmentTemplate,
  createQuestion,
  deleteQuestion,
  getAssessmentInviteLinks,
  getAssessmentTemplates,
  getCreatorInviteRequests,
  getQuestionBank,
  getQuestionDeleteEligibility,
  restoreQuestion,
  saveTemplateItems,
  setDefaultTemplate,
  setTemplateActive,
  updateCreatorInviteRequest,
  updateAssessmentTemplate,
  updateQuestion,
} from '@/lib/creators-api';
import type {
  AssessmentQuestionType,
  CreatorAssessmentInviteLink,
  CreatorAssessmentTemplateItem,
  CreatorAssessmentRuntimeTemplate,
  CreatorInviteRequest,
  CreatorInviteRequestStatus,
  CreatorQuestion,
} from '@/types/creator';

type DraftItem = CreatorAssessmentTemplateItem;
type DeleteEligibility = { canDelete: boolean; reason?: string };
type BuilderTab = 'builder' | 'bank' | 'invites';
type SectionGroup = { id: string; title: string; description: string; heading: DraftItem | null; questions: DraftItem[] };
type LogicMode = 'always' | 'equals' | 'includes';

const QUESTION_TYPES: AssessmentQuestionType[] = ['short_text', 'long_text', 'single_choice', 'multi_choice', 'boolean', 'scale'];
const EMPTY_QUESTION = {
  question_key: '',
  response_key: '',
  question_text: '',
  help_text: '',
  section: 'About You',
  question_type: 'long_text' as AssessmentQuestionType,
  scoring_dimension: '',
  parent_question_key: '',
  show_when_value: '',
  show_when_operator: 'equals' as 'equals' | 'includes',
};
const EMPTY_TEMPLATE = { name: '', slug: '', description: '', duplicateFromTemplateId: '' };
const EMPTY_INVITE = { creatorName: '', creatorEmail: '', notes: '' };
const INVITE_REQUEST_STATUSES: CreatorInviteRequestStatus[] = ['New', 'Reviewed', 'Approved', 'Declined'];
const PUBLIC_ASSESSMENT_ORIGIN = 'https://findyourvertical.online';

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function buildInviteUrl(templateSlug: string, invite: CreatorAssessmentInviteLink): string {
  const params = new URLSearchParams({ ref: invite.invite_code });
  if (invite.creator_email) params.set('email', invite.creator_email);
  return `${PUBLIC_ASSESSMENT_ORIGIN}/a/${templateSlug}?${params.toString()}`;
}

function ordered<T extends { is_included: boolean; sort_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.is_included !== b.is_included) return a.is_included ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
}

function draftItemsFor(template: CreatorAssessmentRuntimeTemplate | null, bank: CreatorQuestion[]): DraftItem[] {
  if (!template) return [];
  const items = [...(template.items ?? [])] as DraftItem[];
  const questionIds = new Set(items.filter(item => item.item_type === 'question').map(item => item.question_id));
  const maxOrder = Math.max(0, ...items.map(item => item.sort_order));

  bank.forEach((question, index) => {
    if (!question.is_active || questionIds.has(question.id)) return;
    items.push({
      id: `available:${template.id}:${question.id}`,
      template_id: template.id,
      item_type: 'question',
      question_id: question.id,
      title: null,
      description: null,
      is_included: false,
      sort_order: maxOrder + ((index + 1) * 10),
      created_at: question.created_at,
      updated_at: question.updated_at,
      question,
    });
  });

  return ordered(items);
}

export function AssessmentTemplates() {
  const [questions, setQuestions] = useState<CreatorQuestion[]>([]);
  const [templates, setTemplates] = useState<CreatorAssessmentRuntimeTemplate[]>([]);
  const [inviteLinks, setInviteLinks] = useState<CreatorAssessmentInviteLink[]>([]);
  const [inviteRequests, setInviteRequests] = useState<CreatorInviteRequest[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateSlug, setTemplateSlug] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [questionForm, setQuestionForm] = useState(EMPTY_QUESTION);
  const [editingQuestion, setEditingQuestion] = useState<CreatorQuestion | null>(null);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');
  const [deleteEligibility, setDeleteEligibility] = useState<Record<string, DeleteEligibility>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [collapsedHeadings, setCollapsedHeadings] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<BuilderTab>('builder');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [bankTypeFilter, setBankTypeFilter] = useState<'all' | AssessmentQuestionType>('all');
  const [draggedItemId, setDraggedItemId] = useState('');
  const [draggedSectionId, setDraggedSectionId] = useState('');
  const [logicMode, setLogicMode] = useState<LogicMode>('always');

  const selectedTemplate = templates.find(template => template.id === selectedTemplateId) ?? templates[0] ?? null;
  const selectedInviteLinks = inviteLinks.filter(link => link.template_id === selectedTemplate?.id);
  const existingItemIds = useMemo(() => new Set(selectedTemplate?.items?.map(item => item.id) ?? []), [selectedTemplate]);
  const includedItems = draftItems.filter(item => item.is_included);
  const editorItems = useMemo(() => {
    let collapsed = false;
    return [...includedItems]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(item => {
        if (item.item_type === 'section_heading') {
          collapsed = Boolean(collapsedHeadings[item.id]);
          return { item, hiddenByCollapse: false };
        }

        return { item, hiddenByCollapse: collapsed };
      });
  }, [includedItems, collapsedHeadings]);
  const previewSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; description: string; questions: DraftItem[] }> = [];
    let current: { id: string; title: string; description: string; questions: DraftItem[] } | null = null;

    for (const item of [...includedItems].sort((a, b) => a.sort_order - b.sort_order)) {
      if (item.item_type === 'section_heading') {
        current = {
          id: item.id,
          title: item.title?.trim() || 'Untitled Section',
          description: item.description ?? '',
          questions: [],
        };
        sections.push(current);
        continue;
      }

      if (!item.question?.is_active) continue;
      if (!current) {
        current = {
          id: 'unsectioned',
          title: 'Unsectioned Questions',
          description: '',
          questions: [],
        };
        sections.push(current);
      }
      current.questions.push(item);
    }

    return sections.filter(section => section.questions.length > 0 || section.id !== 'unsectioned');
  }, [includedItems]);
  const activeQuestions = questions.filter(question => question.is_active);
  const archivedQuestions = questions.filter(question => !question.is_active);
  const canSetDefault = Boolean(
    selectedTemplate?.is_active
    && includedItems.some(item => item.item_type === 'question' && item.question?.is_active)
  );
  const pendingInviteRequests = inviteRequests.filter(request => request.status === 'New').length;
  const sectionGroups = useMemo<SectionGroup[]>(() => {
    const groups: SectionGroup[] = [];
    let current: SectionGroup | null = null;

    for (const item of [...includedItems].sort((a, b) => a.sort_order - b.sort_order)) {
      if (item.item_type === 'section_heading') {
        current = {
          id: item.id,
          title: item.title?.trim() || 'Untitled Section',
          description: item.description ?? '',
          heading: item,
          questions: [],
        };
        groups.push(current);
        continue;
      }

      if (!current) {
        current = {
          id: 'unsectioned',
          title: 'Unsectioned',
          description: '',
          heading: null,
          questions: [],
        };
        groups.push(current);
      }
      current.questions.push(item);
    }

    return groups;
  }, [includedItems]);
  const selectedSection = sectionGroups.find(section => section.id === selectedSectionId) ?? sectionGroups[0] ?? null;
  const selectedItem = draftItems.find(item => item.id === selectedItemId) ?? selectedSection?.heading ?? selectedSection?.questions[0] ?? null;
  const selectedQuestion = selectedItem?.question ?? editingQuestion;
  const filteredBankQuestions = useMemo(() => {
    const query = bankSearch.trim().toLowerCase();
    return questions.filter(question => {
      const typeMatches = bankTypeFilter === 'all' || question.question_type === bankTypeFilter;
      if (!typeMatches) return false;
      if (!query) return true;
      return [
        question.question_text,
        question.question_key,
        question.section,
        question.scoring_dimension ?? '',
      ].some(value => value.toLowerCase().includes(query));
    });
  }, [bankSearch, bankTypeFilter, questions]);

  const initialState = useMemo(() => {
    if (!selectedTemplate) return '';
    return JSON.stringify({
      name: selectedTemplate.name,
      slug: selectedTemplate.slug,
      description: selectedTemplate.description ?? '',
      items: draftItemsFor(selectedTemplate, questions).map(item => ({
        id: item.id,
        item_type: item.item_type,
        question_id: item.question_id,
        title: item.title,
        description: item.description,
        is_included: item.is_included,
        sort_order: item.sort_order,
      })),
    });
  }, [selectedTemplate, questions]);

  const currentState = useMemo(() => JSON.stringify({
    name: templateName,
    slug: templateSlug,
    description: templateDescription,
    items: draftItems.map(item => ({
      id: item.id,
      item_type: item.item_type,
      question_id: item.question_id,
      title: item.title,
      description: item.description,
      is_included: item.is_included,
      sort_order: item.sort_order,
    })),
  }), [templateName, templateSlug, templateDescription, draftItems]);

  const isDirty = Boolean(selectedTemplate) && initialState !== currentState;
  const saveDisabledReason = !selectedTemplate
    ? 'No template selected.'
    : saving
      ? 'Save already in progress.'
      : !isDirty
        ? 'No unsaved changes.'
        : '';
  const archiveDisabledReason = selectedTemplate?.is_default
    ? 'Set another active template as default before archiving this one.'
    : saving
      ? 'Template update already in progress.'
      : '';
  const defaultDisabledReason = !selectedTemplate?.is_active
    ? 'Restore this template before setting it as default.'
    : selectedTemplate?.is_default
      ? 'This template is already the default.'
      : !canSetDefault
        ? 'Template must include at least one active question.'
        : saving
          ? 'Template update already in progress.'
          : '';

  const load = async (preferredTemplateId?: string) => {
    const [bank, loadedTemplates, loadedInviteLinks, loadedInviteRequests] = await Promise.all([
      getQuestionBank(),
      getAssessmentTemplates(),
      getAssessmentInviteLinks(),
      getCreatorInviteRequests(),
    ]);
    setQuestions(bank);
    setTemplates(loadedTemplates);
    setInviteLinks(loadedInviteLinks);
    setInviteRequests(loadedInviteRequests);
    setSelectedTemplateId(current => preferredTemplateId || current || loadedTemplates[0]?.id || '');
    const entries = await Promise.all(bank.map(async question => [question.id, await getQuestionDeleteEligibility(question.id)] as const));
    setDeleteEligibility(Object.fromEntries(entries));
  };

  useEffect(() => {
    load()
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load assessment templates'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateName('');
      setTemplateSlug('');
      setTemplateDescription('');
      setDraftItems([]);
      setSelectedSectionId('');
      setSelectedItemId('');
      return;
    }
    setTemplateName(selectedTemplate.name);
    setTemplateSlug(selectedTemplate.slug);
    setTemplateDescription(selectedTemplate.description ?? '');
    setDraftItems(draftItemsFor(selectedTemplate, questions));
  }, [selectedTemplateId, templates, questions]);

  useEffect(() => {
    if (sectionGroups.length === 0) {
      setSelectedSectionId('');
      setSelectedItemId('');
      return;
    }
    if (!sectionGroups.some(section => section.id === selectedSectionId)) {
      setSelectedSectionId(sectionGroups[0].id);
      setSelectedItemId(sectionGroups[0].heading?.id ?? sectionGroups[0].questions[0]?.id ?? '');
    }
  }, [sectionGroups, selectedSectionId]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const selectTemplate = (templateId: string) => {
    if (isDirty && !window.confirm('Discard unsaved template changes?')) return;
    setError('');
    setSuccess('');
    setSelectedTemplateId(templateId);
  };

  const saveTemplate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateAssessmentTemplate(selectedTemplate.id, {
        name: templateName,
        slug: templateSlug,
        description: templateDescription || null,
      });
      await saveTemplateItems(
        selectedTemplate.id,
        draftItems.filter(item => item.is_included || existingItemIds.has(item.id))
      );
      await load(selectedTemplate.id);
      setSuccess('Template changes saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template changes');
    } finally {
      setSaving(false);
    }
  };

  const addHeading = () => {
    if (!selectedTemplate) {
      setError('Select or create a template before adding a heading.');
      return;
    }
    setError('');
    setSuccess('');
    const nextOrder = Math.max(0, ...includedItems.map(item => item.sort_order)) + 10;
    setDraftItems(current => ordered([
      ...current,
      {
        id: `new-heading-${Date.now()}`,
        template_id: selectedTemplateId,
        item_type: 'section_heading',
        question_id: null,
        title: 'New Section Heading',
        description: '',
        is_included: true,
        sort_order: nextOrder,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        question: null,
      },
    ]));
  };

  const selectBuilderItem = (item: DraftItem | null) => {
    if (!item) return;
    setSelectedItemId(item.id);
    setEditingQuestion(item.question ?? null);
    if (item.question) editQuestion(item.question);
  };

  const updateItem = (id: string, changes: Partial<DraftItem>) => {
    setDraftItems(current => current.map(item => item.id === id ? { ...item, ...changes } : item));
  };

  const removeItemFromTemplate = (item: DraftItem) => {
    updateItem(item.id, { is_included: false });
    setSelectedItemId('');
  };

  const reorderVisibleItems = (visible: DraftItem[]) => {
    const order = new Map(visible.map((current, orderIndex) => [current.id, (orderIndex + 1) * 10]));
    setDraftItems(current => ordered(current.map(row => order.has(row.id) ? { ...row, sort_order: order.get(row.id)! } : row)));
  };

  const duplicateQuestionPlacement = (item: DraftItem): DraftItem | null => {
    if (item.item_type !== 'question' || !item.question) return null;
    const visible = [...includedItems].sort((a, b) => a.sort_order - b.sort_order);
    const index = visible.findIndex(current => current.id === item.id);
    const clone: DraftItem = {
      ...item,
      id: `new-question-placement-${Date.now()}`,
      sort_order: item.sort_order + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const nextVisible = [...visible.slice(0, index + 1), clone, ...visible.slice(index + 1)];
    const order = new Map(nextVisible.map((current, orderIndex) => [current.id, (orderIndex + 1) * 10]));
    setDraftItems(current => ordered([
      ...current.map(row => order.has(row.id) ? { ...row, sort_order: order.get(row.id)! } : row),
      { ...clone, sort_order: order.get(clone.id)! },
    ]));
    return clone;
  };

  const addQuestionToSelectedSection = (question: CreatorQuestion) => {
    if (!selectedTemplate || !selectedSection) return;
    const visible = [...includedItems].sort((a, b) => a.sort_order - b.sort_order);
    const sectionIndex = selectedSection.heading
      ? visible.findIndex(item => item.id === selectedSection.heading?.id)
      : -1;
    const nextSectionIndex = visible.findIndex((item, index) => (
      index > Math.max(sectionIndex, -1)
      && item.item_type === 'section_heading'
    ));
    const insertIndex = nextSectionIndex === -1 ? visible.length : nextSectionIndex;
    const available = draftItems.find(item => (
      item.item_type === 'question'
      && item.question_id === question.id
      && !item.is_included
    ));
    const item: DraftItem = available
      ? { ...available, is_included: true }
      : {
          id: `new-question-placement-${Date.now()}`,
          template_id: selectedTemplate.id,
          item_type: 'question',
          question_id: question.id,
          title: null,
          description: null,
          is_included: true,
          sort_order: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          question,
        };
    const nextVisible = [...visible.slice(0, insertIndex), item, ...visible.slice(insertIndex)];
    const order = new Map(nextVisible.map((current, orderIndex) => [current.id, (orderIndex + 1) * 10]));
    setDraftItems(current => {
      const hasItem = current.some(row => row.id === item.id);
      const rows = hasItem
        ? current.map(row => row.id === item.id ? item : row)
        : [...current, item];
      return ordered(rows.map(row => order.has(row.id) ? { ...row, sort_order: order.get(row.id)! } : row));
    });
    setSelectedItemId(item.id);
    editQuestion(question);
  };

  const onSectionDrop = (targetSectionId: string) => {
    if (!draggedSectionId || draggedSectionId === targetSectionId) return;
    const sourceIndex = sectionGroups.findIndex(section => section.id === draggedSectionId);
    const targetIndex = sectionGroups.findIndex(section => section.id === targetSectionId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const nextGroups = [...sectionGroups];
    const [moved] = nextGroups.splice(sourceIndex, 1);
    nextGroups.splice(targetIndex, 0, moved);
    reorderVisibleItems(nextGroups.flatMap(section => [
      ...(section.heading ? [section.heading] : []),
      ...section.questions,
    ]));
    setDraggedSectionId('');
  };

  const onQuestionDrop = (targetItemId: string) => {
    if (!draggedItemId || draggedItemId === targetItemId || !selectedSection) return;
    const visible = [...includedItems].sort((a, b) => a.sort_order - b.sort_order);
    const sectionQuestionIds = new Set(selectedSection.questions.map(item => item.id));
    if (!sectionQuestionIds.has(draggedItemId) || !sectionQuestionIds.has(targetItemId)) return;
    const dragged = visible.find(item => item.id === draggedItemId);
    if (!dragged) return;
    const withoutDragged = visible.filter(item => item.id !== draggedItemId);
    const targetIndex = withoutDragged.findIndex(item => item.id === targetItemId);
    withoutDragged.splice(targetIndex, 0, dragged);
    reorderVisibleItems(withoutDragged);
    setDraggedItemId('');
  };

  const duplicateSection = (heading: DraftItem) => {
    if (heading.item_type !== 'section_heading') return;
    const includeQuestions = window.confirm('Duplicate the questions under this section too? Choose Cancel to duplicate only the heading.');
    const visible = [...includedItems].sort((a, b) => a.sort_order - b.sort_order);
    const headingIndex = visible.findIndex(item => item.id === heading.id);
    const nextHeadingIndex = visible.findIndex((item, index) => index > headingIndex && item.item_type === 'section_heading');
    const sectionQuestions = nextHeadingIndex === -1
      ? visible.slice(headingIndex + 1)
      : visible.slice(headingIndex + 1, nextHeadingIndex);
    const now = Date.now();
    const clones: DraftItem[] = [
      {
        ...heading,
        id: `new-heading-${now}`,
        title: `${heading.title ?? 'Section Heading'} Copy`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      ...(includeQuestions ? sectionQuestions.map((item, index) => ({
        ...item,
        id: `new-section-question-placement-${now}-${index}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })) : []),
    ];
    const insertIndex = nextHeadingIndex === -1 ? visible.length : nextHeadingIndex;
    const nextVisible = [...visible.slice(0, insertIndex), ...clones, ...visible.slice(insertIndex)];
    const order = new Map(nextVisible.map((item, index) => [item.id, (index + 1) * 10]));
    setDraftItems(current => ordered([
      ...current.map(row => order.has(row.id) ? { ...row, sort_order: order.get(row.id)! } : row),
      ...clones.map(clone => ({ ...clone, sort_order: order.get(clone.id)! })),
    ]));
  };

  const toggleHeadingCollapsed = (id: string) => {
    setCollapsedHeadings(current => ({ ...current, [id]: !current[id] }));
  };

  const submitQuestion = async (event?: FormEvent) => {
    event?.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editingQuestion) {
        const updated = await updateQuestion(editingQuestion.id, {
          question_text: questionForm.question_text,
          help_text: questionForm.help_text || null,
          section: questionForm.section,
          scoring_dimension: questionForm.scoring_dimension || null,
          parent_question_key: logicMode === 'always' ? null : questionForm.parent_question_key || null,
          show_when_value: logicMode === 'always' ? null : questionForm.show_when_value || null,
          show_when_operator: logicMode === 'always' ? 'equals' : logicMode,
          options: editingQuestion.options,
        });
        setEditingQuestion(updated);
        setSuccess('Question updated.');
      } else {
        await createQuestion({
          question_key: questionForm.question_key,
          response_key: questionForm.response_key,
          question_text: questionForm.question_text,
          help_text: questionForm.help_text || null,
          section: questionForm.section,
          question_type: questionForm.question_type,
          scoring_dimension: questionForm.scoring_dimension || null,
          parent_question_key: logicMode === 'always' ? null : questionForm.parent_question_key || null,
          show_when_value: logicMode === 'always' ? null : questionForm.show_when_value || null,
          show_when_operator: logicMode === 'always' ? 'equals' : logicMode,
          options: [],
        });
        setSuccess('Question created.');
      }
      setEditingQuestion(null);
      setQuestionForm(EMPTY_QUESTION);
      setLogicMode('always');
      await load(selectedTemplateId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const editQuestion = (question: CreatorQuestion) => {
    setEditingQuestion(question);
    setQuestionForm({
      question_key: question.question_key,
      response_key: question.response_key,
      question_text: question.question_text,
      help_text: question.help_text ?? '',
      section: question.section,
      question_type: question.question_type,
      scoring_dimension: question.scoring_dimension ?? '',
      parent_question_key: question.parent_question_key ?? '',
      show_when_value: question.show_when_value ?? '',
      show_when_operator: question.show_when_operator ?? 'equals',
    });
    setLogicMode(question.parent_question_key ? question.show_when_operator ?? 'equals' : 'always');
  };

  const createTemplate = async (event?: FormEvent) => {
    event?.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const template = await createAssessmentTemplate({
        name: templateForm.name,
        slug: templateForm.slug || null,
        description: templateForm.description || null,
        duplicateFromTemplateId: templateForm.duplicateFromTemplateId || null,
      });
      setTemplateForm(EMPTY_TEMPLATE);
      await load(template.id);
      setSuccess('Template created. It starts inactive until restored.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const openInviteModal = () => {
    if (!selectedTemplate) return;
    setInviteForm(EMPTY_INVITE);
    setGeneratedInviteUrl('');
    setInviteModalOpen(true);
  };

  const createInviteLink = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedTemplate || !inviteForm.creatorName.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const invite = await createAssessmentInviteLink({
        templateId: selectedTemplate.id,
        creatorName: inviteForm.creatorName,
        creatorEmail: inviteForm.creatorEmail || null,
        notes: inviteForm.notes || null,
      });
      const url = buildInviteUrl(selectedTemplate.slug, invite);
      setGeneratedInviteUrl(url);
      await load(selectedTemplate.id);
      setSuccess('Invite link generated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate invite link');
    } finally {
      setSaving(false);
    }
  };

  const createInviteFromRequest = (request: CreatorInviteRequest) => {
    setInviteForm({
      creatorName: request.name,
      creatorEmail: request.email,
      notes: request.onlyfans_handle ? `Requested from OnlyFans handle @${request.onlyfans_handle}` : '',
    });
    setGeneratedInviteUrl('');
    setInviteModalOpen(true);
  };

  const changeInviteRequestStatus = async (request: CreatorInviteRequest, status: CreatorInviteRequestStatus) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateCreatorInviteRequest(request.id, {
        status,
        notes: request.notes,
      });
      await load(selectedTemplateId);
      setSuccess(`Invite request marked ${status.toLowerCase()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update invite request');
    } finally {
      setSaving(false);
    }
  };

  const copyInviteUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setSuccess('Invite URL copied.');
  };

  const setTemplateStatus = async (isActive: boolean) => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await setTemplateActive(selectedTemplate.id, isActive);
      await load(selectedTemplate.id);
      setSuccess(isActive ? 'Template restored.' : 'Template archived.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update template status');
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (isDirty) {
        await updateAssessmentTemplate(selectedTemplate.id, {
          name: templateName,
          slug: templateSlug,
          description: templateDescription || null,
        });
        await saveTemplateItems(
          selectedTemplate.id,
          draftItems.filter(item => item.is_included || existingItemIds.has(item.id))
        );
      }
      await setDefaultTemplate(selectedTemplate.id);
      await load(selectedTemplate.id);
      setSuccess('Default template updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set default template');
    } finally {
      setSaving(false);
    }
  };

  const questionAction = async (question: CreatorQuestion, action: 'archive' | 'restore' | 'delete') => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (action === 'archive') await archiveQuestion(question.id);
      if (action === 'restore') await restoreQuestion(question.id);
      if (action === 'delete') {
        if (!window.confirm(`Delete "${question.question_text}" permanently?`)) return;
        await deleteQuestion(question.id);
      }
      await load(selectedTemplateId);
      setSuccess(action === 'archive' ? 'Question archived.' : action === 'restore' ? 'Question restored.' : 'Question deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action} question`);
    } finally {
      setSaving(false);
    }
  };

  const duplicateBankQuestion = async (question: CreatorQuestion) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const suffix = Date.now().toString(36);
      const duplicate = await createQuestion({
        question_key: `${question.question_key}_copy_${suffix}`,
        response_key: `${question.response_key}_copy_${suffix}`,
        question_text: `${question.question_text} Copy`,
        help_text: question.help_text,
        section: question.section,
        question_type: question.question_type,
        scoring_dimension: question.scoring_dimension,
        parent_question_key: question.parent_question_key,
        show_when_value: question.show_when_value,
        show_when_operator: question.show_when_operator,
        options: question.options,
      });
      await load(selectedTemplateId);
      editQuestion(duplicate);
      setSelectedItemId('');
      setActiveTab('bank');
      setSuccess('Question duplicated in the bank.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to duplicate question');
    } finally {
      setSaving(false);
    }
  };

  const renderPreviewInput = (item: DraftItem) => {
    const question = item.question;
    if (!question) return null;

    if (question.question_type === 'long_text' || question.question_type === 'textarea') {
      return <textarea disabled rows={Number(question.config.rows ?? 3)} className="mt-2 w-full resize-none rounded-lg border border-gray-300 bg-surface-2 px-4 py-3 text-sm text-gray-500" placeholder="Preview response" />;
    }

    if (question.question_type === 'short_text') {
      return <input disabled className="mt-2 w-full rounded-lg border border-gray-300 bg-surface-2 px-4 py-3 text-sm text-gray-500" placeholder="Preview response" />;
    }

    if (question.question_type === 'scale') {
      return <input disabled type="range" min={Number(question.config.min ?? 1)} max={Number(question.config.max ?? 10)} className="mt-3 w-full accent-accent" />;
    }

    if (question.question_type === 'boolean') {
      return (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled className="btn-subtle rounded-full px-5 py-2 text-gray-500">{String(question.config.trueLabel ?? 'Yes')}</button>
          <button type="button" disabled className="btn-subtle rounded-full px-5 py-2 text-gray-500">{String(question.config.falseLabel ?? 'No')}</button>
        </div>
      );
    }

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {question.options.map((option, index) => {
          const label = typeof option === 'string' ? option : option.label;
          return <button type="button" disabled key={`${label}-${index}`} className="btn-subtle text-gray-500">{label}</button>;
        })}
        {question.options.length === 0 && <span className="text-xs text-gray-600">No options configured.</span>}
      </div>
    );
  };

  if (loading) return <p className="text-sm text-gray-500">Loading Assessment Templates...</p>;

  return (
    <div className="cockpit-page">
      <header className="cockpit-page-header">
        <div>
          <p className="cockpit-eyebrow">Settings</p>
          <h1 className="cockpit-title">Assessment Templates</h1>
          <p className="cockpit-subtitle">Manage assessment templates, question banks, and invite-only assessment links.</p>
        </div>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{success}</div>}

      <div className="space-y-4">
        <div className="cockpit-panel">
          <div className="cockpit-panel-header">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="cockpit-section-title">Assessment Builder</h2>
                <p className="text-xs text-gray-500">Build structure separately from the reusable question bank. Drag sections and questions to reorder.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={selectedTemplate?.id ?? ''} onChange={e => selectTemplate(e.target.value)} className="field-control">
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>{template.name}{template.is_default ? ' (default)' : ''}{template.is_active ? '' : ' (archived)'}</option>
                  ))}
                </select>
                <button type="button" onClick={saveTemplate} disabled={Boolean(saveDisabledReason)} title={saveDisabledReason || undefined} className="btn-primary px-3">Save</button>
                <button type="button" onClick={() => setPreviewOpen(true)} disabled={!selectedTemplate} className="btn-secondary px-3">Preview</button>
                <button type="button" onClick={openInviteModal} disabled={!selectedTemplate} className="btn-secondary px-3">Invite Link</button>
              </div>
            </div>
            {saveDisabledReason && <p className="mt-2 text-xs text-gray-500">Save: {saveDisabledReason}</p>}
          </div>

          {!selectedTemplate ? (
            <p className="p-6 text-sm text-gray-500">No templates yet.</p>
          ) : (
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1.5fr]">
                <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name" className="field-control" />
                <input value={templateSlug} onChange={e => setTemplateSlug(normalizeKey(e.target.value).replace(/_/g, '-'))} placeholder="URL slug" className="field-control" />
                <input value={templateDescription} onChange={e => setTemplateDescription(e.target.value)} placeholder="Description" className="field-control" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setActiveTab('builder')} className={activeTab === 'builder' ? 'btn-primary px-3' : 'btn-subtle'}>Template Builder</button>
                <button type="button" onClick={() => setActiveTab('bank')} className={activeTab === 'bank' ? 'btn-primary px-3' : 'btn-subtle'}>Question Bank</button>
                <button type="button" onClick={() => setActiveTab('invites')} className={activeTab === 'invites' ? 'btn-primary px-3' : 'btn-subtle'}>Invites</button>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedTemplate.is_active ? 'bg-success/10 text-success' : 'bg-warn/10 text-warn'}`}>{selectedTemplate.is_active ? 'Active' : 'Archived'}</span>
                {selectedTemplate.is_default && <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Default</span>}
                {isDirty && <span className="rounded-full bg-warn/10 px-3 py-1 text-xs font-semibold text-warn">Unsaved</span>}
                <button type="button" onClick={addHeading} disabled={!selectedTemplate || saving} className="btn-subtle text-accent">Add Section</button>
                {selectedTemplate.is_active ? (
                  <button type="button" onClick={() => setTemplateStatus(false)} disabled={Boolean(archiveDisabledReason)} title={archiveDisabledReason || undefined} className="btn-subtle">Archive Template</button>
                ) : (
                  <button type="button" onClick={() => setTemplateStatus(true)} disabled={saving} className="btn-subtle text-accent">Restore Template</button>
                )}
                <button type="button" onClick={makeDefault} disabled={Boolean(defaultDisabledReason)} title={defaultDisabledReason || undefined} className="btn-subtle">Set Default</button>
              </div>

              {activeTab === 'builder' && (
                <div className="grid min-h-[36rem] grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
                  <div className="cockpit-panel">
                    <div className="cockpit-panel-header">
                      <h3 className="cockpit-section-title">Sections</h3>
                      <p className="text-xs text-gray-500">{sectionGroups.length} section{sectionGroups.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className="max-h-[32rem] space-y-2 overflow-y-auto p-3">
                      {sectionGroups.length === 0 && <p className="p-3 text-sm text-gray-500">Add a section to start building.</p>}
                      {sectionGroups.map(section => (
                        <button
                          key={section.id}
                          type="button"
                          draggable={Boolean(section.heading)}
                          onDragStart={() => setDraggedSectionId(section.id)}
                          onDragOver={event => event.preventDefault()}
                          onDrop={() => onSectionDrop(section.id)}
                          onClick={() => {
                            setSelectedSectionId(section.id);
                            selectBuilderItem(section.heading ?? section.questions[0] ?? null);
                          }}
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${selectedSection?.id === section.id ? 'border-accent/50 bg-accent/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                        >
                          <span className="block text-sm font-semibold text-gray-900">{section.title}</span>
                          <span className="mt-1 block text-xs text-gray-500">{section.questions.length} question{section.questions.length === 1 ? '' : 's'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="cockpit-panel">
                    <div className="cockpit-panel-header">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="cockpit-section-title">{selectedSection?.title ?? 'Questions'}</h3>
                          <p className="text-xs text-gray-500">Drag questions to reorder within this section. Add more from the Question Bank tab.</p>
                        </div>
                        {selectedSection?.heading && (
                          <button type="button" onClick={() => selectBuilderItem(selectedSection.heading)} className="btn-subtle text-xs">Edit Section</button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-[32rem] space-y-2 overflow-y-auto p-3">
                      {selectedSection?.questions.length === 0 && <p className="p-3 text-sm text-gray-500">No questions in this section yet.</p>}
                      {selectedSection?.questions.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          draggable
                          onDragStart={() => setDraggedItemId(item.id)}
                          onDragOver={event => event.preventDefault()}
                          onDrop={() => onQuestionDrop(item.id)}
                          onClick={() => selectBuilderItem(item)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${selectedItemId === item.id ? 'border-accent/50 bg-accent/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                        >
                          <span className="flex items-start gap-3">
                            <span className="mt-0.5 rounded-lg bg-white/10 px-2 py-1 text-xs text-gray-500">{index + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-gray-900">{item.question?.question_text ?? 'Missing question'}</span>
                              <span className="mt-1 block text-xs text-gray-500">
                                {item.question?.question_type ?? 'unknown'}{item.question?.parent_question_key ? ` / conditional on ${item.question.parent_question_key}` : ' / show always'}
                              </span>
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="cockpit-panel">
                    <div className="cockpit-panel-header">
                      <h3 className="cockpit-section-title">Properties</h3>
                      <p className="text-xs text-gray-500">{selectedItem?.item_type === 'section_heading' ? 'Template section' : selectedQuestion ? 'Reusable bank question' : 'Select a section or question'}</p>
                    </div>
                    <div className="max-h-[32rem] overflow-y-auto p-4">
                      {selectedItem?.item_type === 'section_heading' ? (
                        <div className="space-y-3">
                          <input value={selectedItem.title ?? ''} onChange={e => updateItem(selectedItem.id, { title: e.target.value })} className="field-control w-full font-semibold" />
                          <textarea value={selectedItem.description ?? ''} onChange={e => updateItem(selectedItem.id, { description: e.target.value })} rows={4} placeholder="Section description" className="field-control w-full resize-none" />
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => duplicateSection(selectedItem)} className="btn-subtle">Duplicate Section</button>
                            <button type="button" onClick={() => removeItemFromTemplate(selectedItem)} className="btn-subtle">Remove Section</button>
                          </div>
                        </div>
                      ) : selectedQuestion ? (
                        <form onSubmit={submitQuestion} className="space-y-3">
                          <input value={questionForm.question_text} onChange={e => setQuestionForm(current => ({ ...current, question_text: e.target.value }))} className="field-control w-full font-semibold" />
                          <textarea value={questionForm.help_text} onChange={e => setQuestionForm(current => ({ ...current, help_text: e.target.value }))} rows={3} placeholder="Help text" className="field-control w-full resize-none" />
                          <div className="grid grid-cols-2 gap-2">
                            <input value={questionForm.section} onChange={e => setQuestionForm(current => ({ ...current, section: e.target.value }))} placeholder="Bank section" className="field-control" />
                            <select value={questionForm.question_type} disabled className="field-control opacity-70">
                              {QUESTION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                          </div>
                          <input value={questionForm.scoring_dimension} onChange={e => setQuestionForm(current => ({ ...current, scoring_dimension: e.target.value }))} placeholder="Scoring dimension" className="field-control w-full" />
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Conditional Logic</p>
                            <select
                              value={logicMode}
                              onChange={e => {
                                const mode = e.target.value as LogicMode;
                                setLogicMode(mode);
                                setQuestionForm(current => ({
                                  ...current,
                                  parent_question_key: mode === 'always' ? '' : current.parent_question_key,
                                  show_when_value: mode === 'always' ? '' : current.show_when_value,
                                  show_when_operator: mode === 'always' ? 'equals' : mode,
                                }));
                              }}
                              className="field-control mt-3 w-full"
                            >
                              <option value="always">Show always</option>
                              <option value="equals">Show if question equals value</option>
                              <option value="includes">Show if question contains value</option>
                            </select>
                            {logicMode !== 'always' ? (
                              <div className="mt-3 grid grid-cols-1 gap-2">
                                <select value={questionForm.parent_question_key} onChange={e => setQuestionForm(current => ({ ...current, parent_question_key: e.target.value }))} className="field-control">
                                  <option value="">Choose controlling question</option>
                                  {activeQuestions.filter(question => question.id !== selectedQuestion.id).map(question => (
                                    <option key={question.id} value={question.question_key}>{question.question_text}</option>
                                  ))}
                                </select>
                                <input value={questionForm.show_when_value} onChange={e => setQuestionForm(current => ({ ...current, show_when_value: e.target.value }))} placeholder="Value to match" className="field-control" />
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="submit" disabled={saving} className="btn-primary">Save Question</button>
                            {selectedItem && <button type="button" onClick={() => removeItemFromTemplate(selectedItem)} className="btn-subtle">Remove From Template</button>}
                          </div>
                        </form>
                      ) : (
                        <p className="text-sm text-gray-500">Select a section or question to edit its properties.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'bank' && (
                <div className="grid min-h-[36rem] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="cockpit-panel">
                    <div className="cockpit-panel-header">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="cockpit-section-title">Question Bank</h3>
                          <p className="text-xs text-gray-500">Reusable library. Select a builder section, then add questions to it.</p>
                        </div>
                        <button type="button" onClick={() => { setEditingQuestion(null); setQuestionForm(EMPTY_QUESTION); setLogicMode('always'); setSelectedItemId(''); }} className="btn-secondary">New Question</button>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px]">
                        <input value={bankSearch} onChange={e => setBankSearch(e.target.value)} placeholder="Search question text, key, section, dimension" className="field-control" />
                        <select value={bankTypeFilter} onChange={e => setBankTypeFilter(e.target.value as 'all' | AssessmentQuestionType)} className="field-control">
                          <option value="all">All types</option>
                          {QUESTION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="max-h-[32rem] divide-y divide-gray-200 overflow-y-auto">
                      {filteredBankQuestions.length === 0 && <p className="p-4 text-sm text-gray-500">No matching questions.</p>}
                      {filteredBankQuestions.map(question => {
                        const eligibility = deleteEligibility[question.id] ?? { canDelete: false, reason: 'Checking delete safety...' };
                        return (
                          <div key={question.id} className={`p-4 transition-colors hover:bg-white/5 ${question.is_active ? '' : 'bg-warn/5'}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <button type="button" onClick={() => { editQuestion(question); setSelectedItemId(''); }} className="min-w-0 flex-1 text-left">
                                <span className="block text-sm font-semibold text-gray-900">{question.question_text}</span>
                                <span className="mt-1 block text-xs text-gray-500">{question.question_key} / {question.section} / {question.question_type}{question.is_active ? '' : ' / archived'}</span>
                              </button>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${question.is_active ? 'bg-success/10 text-success' : 'bg-warn/10 text-warn'}`}>{question.is_active ? 'Active' : 'Archived'}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" onClick={() => addQuestionToSelectedSection(question)} disabled={!question.is_active || !selectedSection} className="btn-primary px-3 py-1.5">Add to Template</button>
                              <button type="button" onClick={() => duplicateBankQuestion(question)} className="btn-subtle">Duplicate</button>
                              {question.is_active ? (
                                <button type="button" onClick={() => questionAction(question, 'archive')} className="btn-subtle">Archive</button>
                              ) : (
                                <button type="button" onClick={() => questionAction(question, 'restore')} className="btn-subtle text-accent">Restore</button>
                              )}
                              <button type="button" onClick={() => questionAction(question, 'delete')} disabled={!eligibility.canDelete} title={eligibility.reason} className="btn-subtle">Delete</button>
                              {!eligibility.canDelete && <span className="text-xs text-gray-500">{eligibility.reason}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="cockpit-panel">
                    <div className="cockpit-panel-header">
                      <h3 className="cockpit-section-title">{editingQuestion ? 'Bank Question Properties' : 'Create Bank Question'}</h3>
                      <p className="text-xs text-gray-500">These fields update the reusable question, not a template placement.</p>
                    </div>
                    <form onSubmit={submitQuestion} className="max-h-[32rem] space-y-3 overflow-y-auto p-4">
                      <input value={questionForm.question_text} onChange={e => {
                        const question_text = e.target.value;
                        setQuestionForm(current => {
                          const key = !editingQuestion ? normalizeKey(question_text) : current.question_key;
                          return { ...current, question_text, question_key: key, response_key: !editingQuestion ? key : current.response_key };
                        });
                      }} placeholder="Question text" required className="w-full field-control" />
                      <textarea value={questionForm.help_text} onChange={e => setQuestionForm(current => ({ ...current, help_text: e.target.value }))} placeholder="Help text" rows={3} className="w-full resize-none field-control" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={questionForm.question_key} onChange={e => setQuestionForm(current => ({ ...current, question_key: normalizeKey(e.target.value) }))} disabled={Boolean(editingQuestion)} placeholder="question_key" required className="field-control disabled:opacity-60" />
                        <input value={questionForm.response_key} onChange={e => setQuestionForm(current => ({ ...current, response_key: normalizeKey(e.target.value) }))} disabled={Boolean(editingQuestion)} placeholder="response_key" required className="field-control disabled:opacity-60" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={questionForm.section} onChange={e => setQuestionForm(current => ({ ...current, section: e.target.value }))} placeholder="Section" className="field-control" />
                        <select value={questionForm.question_type} onChange={e => setQuestionForm(current => ({ ...current, question_type: e.target.value as AssessmentQuestionType }))} disabled={Boolean(editingQuestion)} className="field-control disabled:opacity-60">
                          {QUESTION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>
                      <input value={questionForm.scoring_dimension} onChange={e => setQuestionForm(current => ({ ...current, scoring_dimension: e.target.value }))} placeholder="Scoring dimension" className="w-full field-control" />
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Conditional Logic</p>
                        <select
                          value={logicMode}
                          onChange={e => {
                            const mode = e.target.value as LogicMode;
                            setLogicMode(mode);
                            setQuestionForm(current => ({
                              ...current,
                              parent_question_key: mode === 'always' ? '' : current.parent_question_key,
                              show_when_value: mode === 'always' ? '' : current.show_when_value,
                              show_when_operator: mode === 'always' ? 'equals' : mode,
                            }));
                          }}
                          className="field-control mt-3 w-full"
                        >
                          <option value="always">Show always</option>
                          <option value="equals">Show if question equals value</option>
                          <option value="includes">Show if question contains value</option>
                        </select>
                        {logicMode !== 'always' ? (
                          <div className="mt-3 grid gap-2">
                            <select value={questionForm.parent_question_key} onChange={e => setQuestionForm(current => ({ ...current, parent_question_key: e.target.value }))} className="field-control">
                              <option value="">Choose controlling question</option>
                              {activeQuestions.filter(question => !editingQuestion || question.id !== editingQuestion.id).map(question => (
                                <option key={question.id} value={question.question_key}>{question.question_text}</option>
                              ))}
                            </select>
                            <input value={questionForm.show_when_value} onChange={e => setQuestionForm(current => ({ ...current, show_when_value: e.target.value }))} placeholder="Value to match" className="field-control" />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingQuestion ? 'Save Question' : 'Add Question'}</button>
                        {editingQuestion && <button type="button" onClick={() => { setEditingQuestion(null); setQuestionForm(EMPTY_QUESTION); setLogicMode('always'); }} className="btn-secondary">Cancel</button>}
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'invites' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="cockpit-panel">
                    <div className="cockpit-panel-header">
                      <h3 className="cockpit-section-title">Invite Links</h3>
                      <p className="text-xs text-gray-500">Generated links for the selected template.</p>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {selectedInviteLinks.length === 0 && <p className="p-4 text-sm text-gray-500">No invite links generated for this template.</p>}
                      {selectedInviteLinks.map(link => {
                        const url = buildInviteUrl(selectedTemplate.slug, link);
                        return (
                          <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{link.creator_name}</p>
                              <p className="text-xs text-gray-500">{link.invite_code}{link.creator_email ? ` - ${link.creator_email}` : ''}</p>
                            </div>
                            <button type="button" onClick={() => copyInviteUrl(url)} className="btn-subtle">Copy URL</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="cockpit-card-pad">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="cockpit-section-title">Invite Requests</h2>
                        <p className="mt-1 text-xs text-gray-500">{pendingInviteRequests} new request{pendingInviteRequests === 1 ? '' : 's'} awaiting review.</p>
                      </div>
                      <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">{inviteRequests.length}</span>
                    </div>
                    <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                      {inviteRequests.length === 0 && <p className="text-sm text-gray-500">No public invite requests yet.</p>}
                      {inviteRequests.slice(0, 20).map(request => (
                        <div key={request.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">{request.name}</p>
                              <p className="truncate text-xs text-gray-500">{request.email}</p>
                              {request.onlyfans_handle && <p className="mt-1 text-xs text-gray-500">@{request.onlyfans_handle}</p>}
                            </div>
                            <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">{request.status}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <select value={request.status} onChange={e => changeInviteRequestStatus(request, e.target.value as CreatorInviteRequestStatus)} disabled={saving} className="field-control text-xs">
                              {INVITE_REQUEST_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                            </select>
                            <button type="button" onClick={() => createInviteFromRequest(request)} disabled={!selectedTemplate || saving} className="btn-subtle text-xs">Prepare Invite</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

          <div className="cockpit-panel">
            <div className="cockpit-panel-header">
              <h2 className="cockpit-section-title">Create New Template</h2>
              <p className="text-xs text-gray-500">New templates start archived/non-default. Restore them when ready, then set default after at least one active question is included.</p>
            </div>
            <form onSubmit={createTemplate} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_220px_auto]">
              <input value={templateForm.name} onChange={e => setTemplateForm(current => ({ ...current, name: e.target.value }))} placeholder="Template name" required className="field-control" />
              <input value={templateForm.slug} onChange={e => setTemplateForm(current => ({ ...current, slug: normalizeKey(e.target.value).replace(/_/g, '-') }))} placeholder="URL slug" className="field-control" />
              <input value={templateForm.description} onChange={e => setTemplateForm(current => ({ ...current, description: e.target.value }))} placeholder="Description" className="field-control" />
              <select value={templateForm.duplicateFromTemplateId} onChange={e => setTemplateForm(current => ({ ...current, duplicateFromTemplateId: e.target.value }))} className="field-control">
                <option value="">Start blank</option>
                {templates.map(template => <option key={template.id} value={template.id}>Duplicate {template.name}</option>)}
              </select>
              <button type="button" onClick={() => createTemplate()} disabled={saving} className="btn-primary">Create Template</button>
            </form>
          </div>
      </div>

      {inviteModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 px-4">
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-surface p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="cockpit-section-title">Generate Invite Link</h2>
                <p className="mt-1 text-xs text-gray-500">Template: {selectedTemplate.name}</p>
              </div>
              <button type="button" onClick={() => setInviteModalOpen(false)} className="btn-subtle">Close</button>
            </div>
            <form onSubmit={createInviteLink} className="space-y-3">
              <input value={inviteForm.creatorName} onChange={e => setInviteForm(current => ({ ...current, creatorName: e.target.value }))} placeholder="Creator name" required className="w-full field-control" />
              <input type="email" value={inviteForm.creatorEmail} onChange={e => setInviteForm(current => ({ ...current, creatorEmail: e.target.value }))} placeholder="Email optional" className="w-full field-control" />
              <textarea value={inviteForm.notes} onChange={e => setInviteForm(current => ({ ...current, notes: e.target.value }))} rows={3} placeholder="Notes" className="w-full resize-none field-control" />
              <button type="submit" disabled={saving || !inviteForm.creatorName.trim()} className="btn-primary">Create Invite</button>
            </form>
            {generatedInviteUrl && (
              <div className="mt-4 rounded-lg border border-accent/30 bg-accent/10 p-3">
                <p className="break-all text-sm text-gray-900">{generatedInviteUrl}</p>
                <button type="button" onClick={() => copyInviteUrl(generatedInviteUrl)} className="mt-3 btn-subtle text-accent">Copy</button>
              </div>
            )}
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white/85 px-4 py-8">
          <div className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-gray-50 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-gray-50 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-warn">Preview Only</p>
                <h2 className="cockpit-section-title">{templateName || selectedTemplate?.name || 'Assessment Template'}</h2>
                <p className="mt-1 text-sm text-gray-500">This preview uses unsaved draft changes and cannot submit assessment data.</p>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)} className="btn-subtle">Close</button>
            </div>

            <div className="space-y-8 px-5 py-6">
              {previewSections.length === 0 && (
                <p className="rounded-lg border border-gray-200 bg-surface p-4 text-sm text-gray-500">No active included questions to preview.</p>
              )}
              {previewSections.map(section => (
                <section key={section.id} className="space-y-5">
                  <div>
                    <h3 className="cockpit-section-title">{section.title}</h3>
                    {section.description && <p className="mt-2 text-sm leading-6 text-gray-500">{section.description}</p>}
                  </div>
                  <div className="space-y-5">
                    {section.questions.map(item => (
                      <div key={item.id} className="rounded-lg border border-gray-200 bg-surface p-4">
                        <label className="block text-sm font-medium text-gray-700">{item.question?.question_text}</label>
                        {item.question?.help_text && <p className="mt-1 text-xs text-gray-500">{item.question.help_text}</p>}
                        {renderPreviewInput(item)}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              <div className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
                Preview mode only. The public wizard opens from generated invite links only.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




