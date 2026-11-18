import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { TaskStatus } from '../../types';
import { formatDepartmentName } from '../../services/dmsApi';
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ShieldAlert,
  MessageSquare,
  ArrowRight,
  Send,
  Plus,
  Paperclip,
  UserCheck,
  UserX,
  History,
  MessageCircle,
  ListTodo,
  Lock,
  Loader2,
  User as UserIcon,
  FileText,
  Archive,
  XCircle,
} from 'lucide-react';

export const TaskDrawer: React.FC = () => {
  const {
    isTaskDrawerOpen,
    closeTaskDrawer,
    activeTask,
    updateTaskStatus,
    openProofModal,
    approveTask,
    rejectTask,
    toggleChecklistItem,
    addCommentToTask,
    getUserById,
    currentUser,
    chats,
    navigateToMessage,
    openTaskChat,
  } = useAppStore();

  const [newComment, setNewComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

  // Mandatory Reason Dialog State (Reject, Block, Reopen, Cancel)
  const [reasonModalConfig, setReasonModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    actionType: 'reject' | 'block' | 'reopen' | 'cancel';
    targetStatus?: TaskStatus;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: '',
    actionType: 'reject',
  });
  const [modalReasonText, setModalReasonText] = useState('');

  if (!isTaskDrawerOpen || !activeTask) return null;

  const currentUid = Number(currentUser.id);
  const creator = getUserById(activeTask.creatorId);
  const sourceChat = chats.find(
    (c) => c.id === activeTask.sourceChatId || c.linkedTaskId === activeTask.id || c.id === `task_chat_${activeTask.id}`
  );

  // Robust numeric ID checks matching ERP-Task backend & view rules
  const isCreator = Number(activeTask.creatorId) === currentUid;
  const isAssignee = activeTask.assigneeIds.some((id) => Number(id) === currentUid);
  const isReporter = Boolean(
    activeTask.reporterIds && activeTask.reporterIds.map(String).includes(String(currentUser.id))
  );
  const isSuperAdmin =
    currentUser.role?.toLowerCase() === 'admin' ||
    currentUser.role?.toLowerCase() === 'super_admin' ||
    currentUser.department?.toLowerCase() === 'admin';
  const isManagement = isSuperAdmin || isCreator || isReporter;
  const isApprovalWorkflow =
    (activeTask as any).workflowType === 'approval_required' ||
    (activeTask as any).workflow_type === 'approval_required' ||
    activeTask.requiresApproval;

  const isTerminal = ['closed', 'cancelled'].includes(
    (activeTask.status || '').toLowerCase()
  );

  // Overall MoV checklist editing permission (matches ERP-Task index.jsx)
  const canEditMovChecklist =
    !isTerminal &&
    (isAssignee ||
      isSuperAdmin ||
      (isCreator && (!activeTask.movAssignments || activeTask.movAssignments.length === 0)));

  const isOverdue =
    new Date(activeTask.dueDate).getTime() < Date.now() &&
    !['completed', 'closed', 'cancelled'].includes(activeTask.status);

  const handleStatusChangeClick = async (targetStatus: TaskStatus, reason?: string) => {
    if (
      (targetStatus === 'completed' || targetStatus === 'under_review') &&
      activeTask.proofRequired &&
      !activeTask.proof
    ) {
      openProofModal(activeTask.id);
      return;
    }

    setIsUpdatingStatus(true);
    try {
      await updateTaskStatus(activeTask.id, targetStatus, reason);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const openReasonModal = (actionType: 'reject' | 'block' | 'reopen' | 'cancel') => {
    setModalReasonText('');
    switch (actionType) {
      case 'reject':
        setReasonModalConfig({
          isOpen: true,
          title: 'Reject Task Deliverables',
          description:
            'Please provide a mandatory reason for requesting revisions. The task will return to In Progress for assignee corrections.',
          actionLabel: 'Confirm Rejection',
          actionType: 'reject',
          targetStatus: 'rejected',
        });
        break;
      case 'block':
        setReasonModalConfig({
          isOpen: true,
          title: 'Block Task',
          description:
            'Please provide a mandatory reason explaining the roadblock or blocker preventing work.',
          actionLabel: 'Confirm Block',
          actionType: 'block',
          targetStatus: 'blocked',
        });
        break;
      case 'reopen':
        setReasonModalConfig({
          isOpen: true,
          title: 'Reopen Task',
          description:
            'Please provide a mandatory reason explaining why this task is being reopened. It will return to In Progress.',
          actionLabel: 'Confirm Reopen',
          actionType: 'reopen',
          targetStatus: 'in_progress',
        });
        break;
      case 'cancel':
        setReasonModalConfig({
          isOpen: true,
          title: 'Cancel Task',
          description:
            'Please provide a mandatory cancellation reason. Cancelled tasks become inactive.',
          actionLabel: 'Confirm Cancellation',
          actionType: 'cancel',
          targetStatus: 'cancelled',
        });
        break;
    }
  };

  const handleConfirmReasonModal = async () => {
    if (!modalReasonText.trim()) return;
    const reason = modalReasonText.trim();
    setIsUpdatingStatus(true);
    try {
      if (reasonModalConfig.actionType === 'reject') {
        await rejectTask(activeTask.id, reason);
      } else if (reasonModalConfig.targetStatus) {
        await updateTaskStatus(activeTask.id, reasonModalConfig.targetStatus, reason);
      }
      setReasonModalConfig((prev) => ({ ...prev, isOpen: false }));
      setModalReasonText('');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDiscussInChat = () => {
    openTaskChat(activeTask.id);
  };

  const handleGoToSourceMessage = () => {
    if (activeTask.sourceChatId && activeTask.sourceMessageId) {
      navigateToMessage(activeTask.sourceChatId, activeTask.sourceMessageId);
      closeTaskDrawer();
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const text = newComment.trim();
    setNewComment('');
    await addCommentToTask(activeTask.id, text);
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) return;
    rejectTask(activeTask.id, rejectReason.trim());
    setShowRejectInput(false);
    setRejectReason('');
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] md:w-[460px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
            {activeTask.code}
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
            {formatDepartmentName(activeTask.department)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Always allow jumping or starting task chat discussion */}
          <button
            onClick={handleDiscussInChat}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
            title="Open real-time team conversation for this task"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Discuss in Chat</span>
          </button>
          <button
            onClick={closeTaskDrawer}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Drawer Scroll Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Title & Priority Badge */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${activeTask.priority === 'urgent'
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  : activeTask.priority === 'high'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                }`}
            >
              {activeTask.priority} priority
            </span>

            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                activeTask.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : activeTask.status === 'approved'
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                    : activeTask.status === 'under_review'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      : activeTask.status === 'rejected'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : activeTask.status === 'blocked'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : activeTask.status === 'in_progress'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : activeTask.status === 'closed'
                              ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {activeTask.status === 'under_review'
                ? 'Pending Approval'
                : activeTask.status.replace('_', ' ')}
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {activeTask.title}
          </h2>

          {activeTask.description && (
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              {activeTask.description}
            </p>
          )}
        </div>

        {/* Source Chat & Jump to message */}
        {sourceChat && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Associated Chat:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {sourceChat.name}
              </span>
            </div>
            {activeTask.sourceMessageId && (
              <button
                onClick={handleGoToSourceMessage}
                className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold hover:underline shrink-0 cursor-pointer"
              >
                <span>Jump to msg</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Action Buttons: Status / Approval Flow */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Workflow &amp; Lifecycle</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono capitalize">
              {isApprovalWorkflow ? 'Approval-Based' : 'Standard'}
            </span>
          </div>

          {/* Under review banner */}
          {activeTask.status === 'under_review' && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Task is Pending Approval</span>
              </div>
              <p className="text-[11px] opacity-90">
                {isManagement
                  ? 'Deliverables have been submitted for review. Sign off or request revisions below.'
                  : `Waiting for approvers to review deliverables.`}
              </p>
            </div>
          )}

          {/* Approved banner */}
          {activeTask.status === 'approved' && (
            <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>Task Deliverables Approved</span>
              </div>
              <p className="text-[11px] opacity-90">
                Approver has signed off on the deliverables. The task is ready to move to Completed.
              </p>
            </div>
          )}

          {/* Rejected banner */}
          {activeTask.status === 'rejected' && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <UserX className="w-4 h-4 text-rose-600" />
                <span>Revisions Requested / Deliverables Rejected</span>
              </div>
              <p className="text-[11px] opacity-90">
                {activeTask.approval?.reason
                  ? `Reason: "${activeTask.approval.reason}"`
                  : 'Deliverables were rejected. Please resume work in progress and address feedback.'}
              </p>
            </div>
          )}

          {/* Blocked banner */}
          {activeTask.status === 'blocked' && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Task is Blocked</span>
              </div>
              <p className="text-[11px] opacity-90">
                An active impediment or blocker was recorded. Unblock task when ready to resume.
              </p>
            </div>
          )}

          {/* Closed banner */}
          {activeTask.status === 'closed' && (
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <Archive className="w-4 h-4 text-slate-500" />
                <span>Task is Formally Closed</span>
              </div>
              <p className="text-[11px] opacity-90">
                This task has been verified, closed, and archived. Authorized managers can reopen if needed.
              </p>
            </div>
          )}

          {/* Cancelled banner */}
          {activeTask.status === 'cancelled' && (
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <XCircle className="w-4 h-4 text-slate-500" />
                <span>Task Cancelled</span>
              </div>
              <p className="text-[11px] opacity-90">
                This task has been cancelled and is no longer active.
              </p>
            </div>
          )}

          {/* Action Buttons matching State Machine */}
          <div className="flex flex-wrap gap-2 pt-1">
            {/* 1. When TODO / OPEN */}
            {activeTask.status === 'todo' && (
              <button
                onClick={() => handleStatusChangeClick('in_progress')}
                disabled={isUpdatingStatus}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Start Task (In Progress)</span>
              </button>
            )}

            {/* 2. When IN_PROGRESS */}
            {activeTask.status === 'in_progress' && (
              <>
                {isApprovalWorkflow ? (
                  <button
                    onClick={() => {
                      if (activeTask.proofRequired && !activeTask.proof) {
                        openProofModal(activeTask.id);
                      } else {
                        handleStatusChangeClick('under_review');
                      }
                    }}
                    disabled={isUpdatingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for Approval</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (activeTask.proofRequired && !activeTask.proof) {
                        openProofModal(activeTask.id);
                      } else {
                        handleStatusChangeClick('completed');
                      }
                    }}
                    disabled={isUpdatingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete Task</span>
                  </button>
                )}

                <button
                  onClick={() => openReasonModal('block')}
                  disabled={isUpdatingStatus}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 border border-rose-200 dark:border-rose-900"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Block Task</span>
                </button>
              </>
            )}

            {/* 3. When BLOCKED */}
            {activeTask.status === 'blocked' && (
              <button
                onClick={() => handleStatusChangeClick('in_progress')}
                disabled={isUpdatingStatus}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Unblock Task (Resume)</span>
              </button>
            )}

            {/* 4. When UNDER_REVIEW (Pending Approval) */}
            {activeTask.status === 'under_review' && isManagement && (
              <>
                <button
                  onClick={() => approveTask(activeTask.id)}
                  disabled={isUpdatingStatus}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Approve Deliverables</span>
                </button>
                <button
                  onClick={() => openReasonModal('reject')}
                  disabled={isUpdatingStatus}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/80 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Request Revisions (Reject)</span>
                </button>
              </>
            )}

            {/* 5. When APPROVED */}
            {activeTask.status === 'approved' && (
              <button
                onClick={() => handleStatusChangeClick('completed')}
                disabled={isUpdatingStatus}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Completed</span>
              </button>
            )}

            {/* 6. When REJECTED */}
            {activeTask.status === 'rejected' && (isAssignee || isManagement) && (
              <button
                onClick={() => handleStatusChangeClick('in_progress')}
                disabled={isUpdatingStatus}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Resume Work (In Progress)</span>
              </button>
            )}

            {/* 7. When COMPLETED */}
            {activeTask.status === 'completed' && (
              <>
                {isManagement && (
                  <button
                    onClick={() => handleStatusChangeClick('closed')}
                    disabled={isUpdatingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Close Task</span>
                  </button>
                )}
                {isManagement && (
                  <button
                    onClick={() => openReasonModal('reopen')}
                    disabled={isUpdatingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span>Reopen Task</span>
                  </button>
                )}
              </>
            )}

            {/* 8. When CLOSED */}
            {activeTask.status === 'closed' && isManagement && (
              <button
                onClick={() => openReasonModal('reopen')}
                disabled={isUpdatingStatus}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>Reopen Task</span>
              </button>
            )}

            {/* Cancel Task (Allowed on any active non-terminal state by Management) */}
            {!['completed', 'closed', 'cancelled'].includes(activeTask.status) && isManagement && (
              <button
                onClick={() => openReasonModal('cancel')}
                disabled={isUpdatingStatus}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                title="Cancel Task"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Proof Submission Card (If proof submitted) */}
        {activeTask.proof && (
          <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-purple-600" />
                Verified Completion Proof
              </span>
              <span className="text-[10px] font-mono tabular-nums text-purple-600 dark:text-purple-400">
                {formatDateTime(activeTask.proof.submittedAt)}
              </span>
            </div>

            {activeTask.proof.photoUrl && (
              !activeTask.proof.fileType ||
                activeTask.proof.fileType.startsWith('image/') ||
                activeTask.proof.photoUrl.startsWith('data:image') ||
                activeTask.proof.photoUrl.includes('images.unsplash') ? (
                <div className="rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800 max-h-48 bg-black/10">
                  <img
                    src={activeTask.proof.photoUrl}
                    alt="Proof submission"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 shadow-xs">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {activeTask.proof.fileName || 'Attached Proof Document'}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {activeTask.proof.fileSize || 'Document attachment'}
                    </p>
                  </div>
                  <a
                    href={activeTask.proof.photoUrl}
                    download={activeTask.proof.fileName || 'proof_document'}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors"
                  >
                    Download
                  </a>
                </div>
              )
            )}

            <p className="text-xs text-purple-950 dark:text-purple-100 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-purple-100 dark:border-purple-900 leading-relaxed">
              "{activeTask.proof.note}"
            </p>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs border-y border-slate-100 dark:border-slate-800 py-4">
          <div>
            <span className="text-slate-400 dark:text-slate-500 block mb-1">Due Date</span>
            <div
              className={`font-semibold font-mono tabular-nums flex items-center gap-1.5 ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'
                }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDateTime(activeTask.dueDate)}</span>
            </div>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block mb-1">Created By</span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${creator ? creator.avatarBg : 'bg-slate-500'
                  }`}
              >
                {creator ? creator.avatar : 'AD'}
              </div>
              <span>{creator ? creator.name : `User #${activeTask.creatorId}`}</span>
            </div>
          </div>

          <div className="col-span-2">
            <span className="text-slate-400 dark:text-slate-500 block mb-1.5">Assignees</span>
            <div className="flex flex-wrap gap-2">
              {activeTask.assigneeIds.map((userId) => {
                const assignee = getUserById(userId);
                return (
                  <div
                    key={userId}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
                  >
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${assignee ? assignee.avatarBg : 'bg-emerald-600'
                        }`}
                    >
                      {assignee ? assignee.avatar : 'U'}
                    </div>
                    <span>{assignee ? assignee.name : `User #${userId}`}</span>
                  </div>
                );
              })}            </div>
          </div>

          {activeTask.reporterIds && activeTask.reporterIds.length > 0 && (
            <div className="col-span-2">
              {/* <span className="text-slate-400 dark:text-slate-500 block mb-1.5">Reporting Manager / Supervisor</span> */}
              {/* <div className="flex flex-wrap gap-2">
                {activeTask.reporterIds.map((userId) => {
                  const reporter = getUserById(userId);
                  return (
                    <div
                      key={userId}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs font-medium"
                    >
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
                          reporter ? reporter.avatarBg : 'bg-amber-600'
                        }`}
                      >
                        {reporter ? reporter.avatar : 'M'}
                      </div>
                      <span>{reporter ? `${reporter.name} (${reporter.designation})` : `Manager #${userId}`}</span>
                    </div>
                  );
                })}
              </div> */}
            </div>
          )}
        </div>

        {/* Interactive Checklist / Means of Verification (MoV) */}
        {activeTask.checklist.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Means of Verification (MoV)</span>
              </h4>
              <span className="text-[11px] font-mono font-semibold tabular-nums text-slate-600 dark:text-slate-400">
                {activeTask.checklist.filter((i) => i.completed).length} / {activeTask.checklist.length} ({activeTask.progress ?? 0}%)
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, activeTask.progress ?? 0))}%` }}
              />
            </div>

            {/* Terminal status notice */}
            {isTerminal && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Checklist is locked because task status is <strong>{activeTask.status.replace('_', ' ')}</strong>.</span>
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              {activeTask.checklist.map((item) => {
                const isChecked = Boolean(item.completed);
                const isCheckedByOther =
                  isChecked && item.completedById != null && Number(item.completedById) !== currentUid;
                const isCreatorOnAnotherUsersMov =
                  isCreator && item.assignedUserId != null && Number(item.assignedUserId) !== currentUid;
                const isAssignedToCurrentUser =
                  item.assignedUserId != null && Number(item.assignedUserId) === currentUid;
                const isItemDisabled =
                  isTerminal ||
                  isCheckedByOther ||
                  (!canEditMovChecklist && !isAssignedToCurrentUser) ||
                  isCreatorOnAnotherUsersMov;
                const isTogglingThis = togglingItemId === item.id;

                const completedUser = item.completedById
                  ? getUserById(String(item.completedById))
                  : item.completedBy
                    ? getUserById(String(item.completedBy))
                    : null;

                const assignedUser = item.assignedUserId != null ? getUserById(String(item.assignedUserId)) : null;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isItemDisabled && !isTogglingThis) {
                        setTogglingItemId(item.id);
                        toggleChecklistItem(activeTask.id, item.id).finally(() => {
                          setTogglingItemId(null);
                        });
                      }
                    }}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all ${isItemDisabled
                        ? 'cursor-not-allowed bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-800/50 opacity-80'
                        : 'cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 shadow-sm'
                      } ${isChecked
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                      }`}
                  >
                    <div className="pt-0.5 flex-shrink-0">
                      {isTogglingThis ? (
                        <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isItemDisabled}
                          onChange={() => { }}
                          className={`rounded text-emerald-600 focus:ring-emerald-500 ${isItemDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs ${isChecked
                              ? 'line-through text-slate-400 dark:text-slate-500 font-normal'
                              : 'text-slate-800 dark:text-slate-100 font-medium'
                            }`}
                        >
                          {item.title}
                        </span>

                        {/* Status badges */}
                        {isCheckedByOther && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            <Lock className="w-2.5 h-2.5" />
                            Locked
                          </span>
                        )}

                        {isCreatorOnAnotherUsersMov && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            <UserIcon className="w-2.5 h-2.5" />
                            Assigned to {assignedUser?.name || `User #${item.assignedUserId}`}
                          </span>
                        )}
                      </div>

                      {/* Detail row */}
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                        {assignedUser && !isCreatorOnAnotherUsersMov && (
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-2.5 h-2.5 text-slate-400" />
                            For: <strong className="text-slate-600 dark:text-slate-300">{assignedUser.name}</strong>
                          </span>
                        )}

                        {isChecked && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                            Completed by:{' '}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {completedUser?.name || (item.completedById ? `User #${item.completedById}` : (item.completedBy || 'Team member'))}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attachments */}
        {activeTask.attachments.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-slate-400" />
              <span>Attachments ({activeTask.attachments.length})</span>
            </h4>
            <div className="space-y-1.5">
              {activeTask.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                    {att.name}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-slate-400 ml-2">
                    {att.size || 'File'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments Thread */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Comments &amp; Discussion ({activeTask.comments.length})
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Live Thread</span>
          </div>

          <div className="space-y-2 mb-3">
            {activeTask.comments.map((comm) => {
              const commentAuthor = getUserById(comm.userId);
              return (
                <div
                  key={comm.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {commentAuthor ? commentAuthor.name : `User #${comm.userId}`}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">
                      {formatDateTime(comm.createdAt)}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {comm.text}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Add comment form */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              placeholder="Add remark to task..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              Post
            </button>
          </form>
        </div>

        {/* Chronological Activity Log */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-400" />
            <span>Audit History</span>
          </h4>
          <div className="space-y-2 text-xs">
            {activeTask.activityLog.map((log) => {
              const actor = getUserById(log.userId);
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2 text-slate-500 dark:text-slate-400 text-[11px]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {actor ? actor.name : `User #${log.userId}`}:
                    </span>{' '}
                    <span>{log.action}</span>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums shrink-0">
                    {formatDateTime(log.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mandatory Reason Dialog */}
      {reasonModalConfig.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {reasonModalConfig.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {reasonModalConfig.description}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mandatory Reason / Note <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={modalReasonText}
                onChange={(e) => setModalReasonText(e.target.value)}
                placeholder="Enter a specific reason for this action..."
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setReasonModalConfig((prev) => ({ ...prev, isOpen: false }));
                  setModalReasonText('');
                }}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReasonModal}
                disabled={!modalReasonText.trim() || isUpdatingStatus}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{reasonModalConfig.actionLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
