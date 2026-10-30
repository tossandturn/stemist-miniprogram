const { deviceState, syncDevice } = require("../../utils/page"), { readSession, saveSession, needsSignIn, questionView, epoch, markQuestion, saveChoice, markChoice, refreshQuestionDisplay } = require("../../utils/nativePractice"), { CHOICES } = require("../../utils/nativeChoice"), { isAuthError } = require("../../utils/api"), { routeById } = require("../../utils/stemRoutes");
const { sourceImageLoaded } = require('../../utils/sourceRegion');
Page({ onShareAppMessage() {
  return require("../../utils/share").onShareAppMessage.call(this);
}, data: deviceState({ sessionId: "", routeId: "", stage: "", subjectCode: "", title: "", unavailableParts: 0, question: null, index: 0, total: 0, navItems: [], answeredCount: 0, photo: "", photoMissing: false, results: [], reviewComplete: false, reviewedCount: 0, busy: false, cameraBusy: false, status: "", error: "", authRequired: false, choices: CHOICES, choice: "", objectiveResult: null }), onLoad(t = {}) {
  this.__disposed = false, this.__displayChecks = /* @__PURE__ */ new Set(), this.setData({ sessionId: String(t.sessionId || "") }), this.refresh();
}, onShow() {
  syncDevice(this), this.setData({ cameraBusy: false, coachOpening: false }), this.refresh();
}, onResize() {
  syncDevice(this);
}, onUnload() {
  this.__disposed = true;
}, refresh() {
  if (this.__disposed) return;
  const t = readSession(this.data.sessionId);
  if (!t) {
    const s = needsSignIn(this.data.sessionId);
    this.setData({ question: null, photo: "", results: [], navItems: [], authRequired: s, error: s ? "练习和照片仍保存在本机。请登录原账号继续。" : "未找到可恢复的练习，请返回重新组卷。" });
    return;
  }
  const e = questionView(t, t.index), a = routeById(t.routeId)?.subjectLabel || t.subjectCode;
  const lost = r => r && Number.isFinite(r.score) && Number.isFinite(r.maxScore) && r.maxScore > 0 && r.score >= 0 && r.score < r.maxScore;
  e.canAskCoach = Boolean((e.objectiveResult?.available !== false && lost(e.objectiveResult)) || e.results.some(lost));
  this.data.question?.id === e.question.id && (e.question.images = e.question.images.map((s) => {
    const i = this.data.question.images.find((r) => r.id === s.id && r.url === s.url);
    return i ? { ...s, ...(i.naturalSize ? sourceImageLoaded(s, ...i.naturalSize) : { loaded: i.loaded, failed: i.failed }) } : s;
  }));
  e.question.fullPage = e.question.fullPage || e.question.images.some(s => s.fullPageFallback);
  this.setData({ ...e, routeId: t.routeId, stage: t.stage, subjectCode: t.subjectCode, title: a.startsWith(t.stage) ? a : `${t.stage} ${a}`, photoMissing: e.photo === this.data.photo ? this.data.photoMissing : false, authRequired: this.data.authRequired && !wx.getStorageSync("stemistSessionToken") }), e.question.choiceMode && e.question.fullPage && this.__displayChecks && !this.__displayChecks.has(e.question.id) && (this.__displayChecks.add(e.question.id), refreshQuestionDisplay(t.id, e.question.id, () => !this.__disposed).then((s) => {
    s && !this.__disposed && this.refresh();
  }).catch(() => {
  }));
}, askCoach() {
  if (this.__disposed || this.data.busy || this.data.coachOpening || !this.data.canAskCoach) return;
  this.setData({ coachOpening: true, error: '' });
  wx.navigateTo({ url: '/bundles/coach/practice?sessionId=' + encodeURIComponent(this.data.sessionId) + '&questionId=' + encodeURIComponent(this.data.question.id), fail: () => { if (!this.__disposed) this.setData({ coachOpening: false, error: 'AI Coach 未能打开，请重试。' }); } });
}, goQuestion(t) {
  if (this.data.busy) return;
  const e = Number(t.currentTarget.dataset.index), a = readSession(this.data.sessionId);
  if (!(!a || !Number.isInteger(e) || e < 0 || e >= a.questions.length)) try {
    a.index = e, saveSession(a), this.setData({ error: "", status: "", photoMissing: false }), this.refresh(), wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  } catch (s) {
    this.setData({ error: s.message });
  }
}, imageLoaded(t) {
  const image = this.data.question?.images.find(s => s.id === t.currentTarget.dataset.id);
  if (image) this.setImageState(t, sourceImageLoaded(image, t.detail?.width, t.detail?.height));
}, imageFailed(t) {
  this.setImageState(t, { loaded: false, failed: true });
}, setImageState(t, e) {
  const a = t.currentTarget.dataset.id;
  this.data.question?.images.some((s) => s.id === a) && this.setData({ question: { ...this.data.question, fullPage: this.data.question.fullPage || Boolean(e.fullPageFallback), images: this.data.question.images.map((s) => s.id === a ? { ...s, ...e } : s) } });
}, retryImage(t) {
  const e = t.currentTarget.dataset.id, a = this.data.question?.images.find((i) => i.id === e);
  if (!a) return;
  const s = a.url;
  this.setImageState(t, { url: "", loaded: false, failed: false }), wx.nextTick(() => {
    this.__disposed || this.setImageState(t, { url: s });
  });
}, previewQuestion(t) {
  const e = this.data.question?.images || [], a = e.find((i) => i.id === t.currentTarget.dataset.id), s = (i) => String(i || "").replace(/&view=region$/, "");
  a?.url && wx.previewImage({ current: s(a.url), urls: e.map((i) => s(i.url)).filter(Boolean), fail: () => this.setData({ error: "原图暂未打开，请重试。" }) });
}, previewPhoto() {
  this.data.photo && wx.previewImage({ current: this.data.photo, urls: [this.data.photo] });
}, photoFailed() {
  this.setData({ photoMissing: true, error: "本机照片未能读取，请重新拍摄。其他题的答案不受影响。" });
}, capture() {
  this.data.busy || this.data.cameraBusy || !this.data.question || this.data.question.choiceMode || (this.setData({ cameraBusy: true, error: "" }), wx.setStorageSync("stemistCameraReturn", { route: "native-practice", context: { sessionId: this.data.sessionId, questionId: this.data.question.id, privacyEpoch: epoch(), category: "alevel", family: "exam", routeId: this.data.routeId, stage: this.data.stage, subjectCode: this.data.subjectCode } }), wx.navigateTo({ url: "/pages/stem/camera", fail: () => this.setData({ cameraBusy: false, error: "相机未能打开，请重试。" }) }));
}, chooseAnswer(t) {
  if (!(this.__disposed || this.data.busy || !this.data.question?.choiceMode)) try {
    saveChoice(this.data.sessionId, this.data.question.id, String(t.currentTarget.dataset.value || "")), this.setData({ status: "答案已保存", error: "" }), this.refresh();
  } catch (e) {
    this.setData({ error: e.message });
  }
}, async submit() {
  if (this.data.question?.choiceMode) {
    if (this.data.busy || !this.data.choice) return;
    const t = this.data.question.original === true;
    this.setData({ busy: true, error: "", authRequired: false, status: t ? "正在提交原创基础练习…" : "正在核对答案…" });
    try {
      await markChoice(this.data.sessionId, this.data.question.id), this.__disposed || this.setData({ status: t ? "学习结果已保存" : "答案已提交" });
    } catch (e) {
      this.__disposed || this.setData({ error: e.message, authRequired: isAuthError(e), status: "答案已保留" });
    } finally {
      this.__disposed || (this.setData({ busy: false }), this.refresh());
    }
    return;
  }
  if (!(this.data.busy || !this.data.photo || this.data.photoMissing || !this.data.question?.canMark)) {
    this.setData({ busy: true, error: "", authRequired: false, status: "正在提交本题…" });
    try {
      await markQuestion(this.data.sessionId, this.data.question.id, (t) => {
        this.__disposed || (this.setData({ status: t }), this.refresh());
      }), this.__disposed || this.setData({ status: "批改结果已保存" });
    } catch (t) {
      this.__disposed || this.setData({ error: isAuthError(t) ? "请登录后批改，拍好的照片会保留。" : t.message || "批改暂未完成，照片和已有反馈已保留。", authRequired: isAuthError(t), status: "尚未完成批改" });
    } finally {
      this.__disposed || (this.setData({ busy: false }), this.refresh());
    }
  }
}, openAccount() {
  wx.navigateTo({ url: "/pages/account/auth" });
}, backToTopics() {
  wx.navigateBack({ fail: () => wx.redirectTo({ url: `/pages/stem/topics?routeId=${encodeURIComponent(this.data.routeId)}` }) });
} });
