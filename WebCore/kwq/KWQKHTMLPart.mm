/*
 * Copyright (C) 2001, 2002 Apple Computer, Inc.  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE COMPUTER, INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE COMPUTER, INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. 
 */

#import "KWQKHTMLPart.h"

#import "htmltokenizer.h"
#import "html_documentimpl.h"
#import "render_root.h"
#import "render_frames.h"
#import "render_text.h"
#import "khtmlpart_p.h"
#import "khtmlview.h"

#import "WebCoreBridge.h"
#import "WebCoreViewFactory.h"

#import "KWQLogging.h"

#undef _KWQ_TIMING

using khtml::Cache;
using khtml::ChildFrame;
using khtml::Decoder;
using khtml::RenderObject;
using khtml::RenderPart;
using khtml::RenderText;
using khtml::RenderWidget;

using KIO::Job;

using KParts::ReadOnlyPart;
using KParts::URLArgs;

void KHTMLPart::completed()
{
    kwq->_completed.call();
}

void KHTMLPart::completed(bool arg)
{
    kwq->_completed.call(arg);
}

void KHTMLPart::nodeActivated(const DOM::Node &aNode)
{
}

void KHTMLPart::onURL(const QString &)
{
}

void KHTMLPart::setStatusBarText(const QString &status)
{
    kwq->setStatusBarText(status);
}

void KHTMLPart::started(Job *j)
{
    kwq->_started.call(j);
}

static void redirectionTimerMonitor(void *context)
{
    KWQKHTMLPart *kwq = static_cast<KWQKHTMLPart *>(context);
    kwq->redirectionTimerStartedOrStopped();
}

KWQKHTMLPart::KWQKHTMLPart(KHTMLPart *p)
    : part(p), d(part->d)
    , _started(p, SIGNAL(started(KIO::Job *)))
    , _completed(p, SIGNAL(completed()))
    , _completedWithBool(p, SIGNAL(completed(bool)))
    , _needsToSetWidgetsAside(false)
{
    Cache::init();
    mutableInstances().prepend(this);
    d->m_redirectionTimer.setMonitor(redirectionTimerMonitor, this);
}

KWQKHTMLPart::~KWQKHTMLPart()
{
    mutableInstances().remove(this);
}

WebCoreBridge *KWQKHTMLPart::bridgeForFrameName(const QString &frameName)
{
    WebCoreBridge *frame;
    if (frameName.isEmpty()) {
        // If we're the only frame in a frameset then pop the frame.
        KHTMLPart *parentPart = part->parentPart();
        frame = parentPart ? parentPart->kwq->_bridge : nil;
        if ([[frame childFrames] count] != 1) {
            frame = _bridge;
        }
    } else {
        frame = [_bridge findOrCreateFramedNamed:frameName.getNSString()];
    }
    
    return frame;
}

void KWQKHTMLPart::openURL(const KURL &url)
{
    NSURL *cocoaURL = url.getNSURL();
    if (cocoaURL == nil) {
        // FIXME: We need to report this error to someone.
    } else {
        [_bridge loadURL:cocoaURL];
    }
}

void KWQKHTMLPart::openURLRequest(const KURL &url, const URLArgs &args)
{
    NSURL *cocoaURL = url.getNSURL();
    if (cocoaURL == nil) {
        // FIXME: We need to report this error to someone.
    } else {
        [bridgeForFrameName(args.frameName) loadURL:cocoaURL];
    }
}

void KWQKHTMLPart::slotData(NSString *encoding, bool forceEncoding, const char *bytes, int length, bool complete)
{
    if (!d->m_workingURL.isEmpty()) {
        part->begin(d->m_workingURL, 0, 0);
        d->m_workingURL = KURL();
    }

    if (encoding) {
        part->setEncoding(QString::fromNSString(encoding), forceEncoding);
    } else {
        part->setEncoding(QString::null, false);
    }
    
    ASSERT(d->m_doc != NULL);

    part->write(bytes, length);
}

void KWQKHTMLPart::urlSelected(const KURL &url, int button, int state, const URLArgs &args)
{
    NSURL *cocoaURL = url.getNSURL();
    if (cocoaURL == nil) {
        // FIXME: Do we need to report an error to someone?
        return;
    }
    
    [bridgeForFrameName(args.frameName) loadURL:cocoaURL];
}

class KWQPluginPart : public ReadOnlyPart
{
    virtual bool openURL(const KURL &) { return true; }
    virtual bool closeURL() { return true; }
};

ReadOnlyPart *KWQKHTMLPart::createPart(const ChildFrame &child, const KURL &url, const QString &mimeType)
{
    NSURL *childURL = url.getNSURL();
    if (childURL == nil) {
        // FIXME: Do we need to report an error to someone?
        return 0;
    }
    
    if (child.m_type == ChildFrame::Object) {
        NSMutableArray *attributesArray = [NSMutableArray arrayWithCapacity:child.m_params.count()];
        for (uint i = 0; i < child.m_params.count(); i++) {
            [attributesArray addObject:child.m_params[i].getNSString()];
        }
        
        KWQPluginPart *newPart = new KWQPluginPart;
        newPart->setWidget(new QWidget([_bridge viewForPluginWithURL:childURL
                                                          attributes:attributesArray
                                                             baseURL:KURL(d->m_doc->baseURL()).getNSURL()
                                                            MIMEType:child.m_args.serviceType.getNSString()]));
        return newPart;
    } else {
        LOG(Frames, "name %s", child.m_name.ascii());
        HTMLIFrameElementImpl *o = static_cast<HTMLIFrameElementImpl *>(child.m_frame->element());
        WebCoreBridge *childBridge = [_bridge createChildFrameNamed:child.m_name.getNSString() withURL:childURL
            renderPart:child.m_frame allowsScrolling:o->scrollingMode() != QScrollView::AlwaysOff
            marginWidth:o->getMarginWidth() marginHeight:o->getMarginHeight()];
        return [childBridge part];
    }
}
    
void KWQKHTMLPart::submitForm(const KURL &u, const URLArgs &args)
{
    if (!args.doPost()) {
	[bridgeForFrameName(args.frameName) loadURL:u.getNSURL()];
    } else {
        QString contentType = args.contentType();
        ASSERT(contentType.startsWith("Content-Type: "));
	[bridgeForFrameName(args.frameName) postWithURL:u.getNSURL()
                   data:[NSData dataWithBytes:args.postData.data() length:args.postData.size()]
            contentType:contentType.mid(14).getNSString()];
    }
}

void KWQKHTMLPart::setView(KHTMLView *view)
{
    d->m_view = view;
    part->setWidget(view);
}

KHTMLView *KWQKHTMLPart::view() const
{
    return d->m_view;
}

void KWQKHTMLPart::setTitle(const DOMString &title)
{
    [_bridge setTitle:title.string().getNSString()];
}

void KWQKHTMLPart::setStatusBarText(const QString &status)
{
    [_bridge setStatusText:status.getNSString()];
}

void KWQKHTMLPart::scheduleClose()
{
    [[_bridge window] performSelector:@selector(close) withObject:nil afterDelay:0.0];
}

void KWQKHTMLPart::unfocusWindow()
{
    [_bridge unfocusWindow];
}

void KWQKHTMLPart::jumpToSelection()
{
    // Assumes that selection will only ever be text nodes. This is currently
    // true, but will it always be so?
    if (!d->m_selectionStart.isNull()) {
        RenderText *rt = dynamic_cast<RenderText *>(d->m_selectionStart.handle()->renderer());
        if (rt) {
            int x = 0, y = 0;
            rt->posOfChar(d->m_startOffset, x, y);
            // The -50 offset is copied from KHTMLPart::findTextNext, which sets the contents position
            // after finding a matched text string.
            d->m_view->setContentsPos(x - 50, y - 50);
        }
    }
}

void KWQKHTMLPart::redirectionTimerStartedOrStopped()
{
    if (d->m_redirectionTimer.isActive()) {
        [_bridge reportClientRedirectTo:KURL(d->m_redirectURL).getNSURL()
                                  delay:d->m_delayRedirect
                               fireDate:[d->m_redirectionTimer.getNSTimer() fireDate]];
    } else {
        [_bridge reportClientRedirectCancelled];
    }
}

static void moveWidgetsAside(RenderObject *object)
{
    // Would use dynamic_cast, but a virtual function call is faster.
    if (object->isWidget()) {
        QWidget *widget = static_cast<RenderWidget *>(object)->widget();
        if (widget) {
            widget->move(999999, 0);
        }
    }
    
    for (RenderObject *child = object->firstChild(); child; child = child->nextSibling()) {
        moveWidgetsAside(child);
    }
}

void KWQKHTMLPart::layout()
{
    // Since not all widgets will get a print call, it's important to move them away
    // so that they won't linger in an old position left over from a previous print.
    _needsToSetWidgetsAside = true;
}

void KWQKHTMLPart::paint(QPainter *p, const QRect &rect)
{
#ifdef DEBUG_DRAWING
    [[NSColor redColor] set];
    [NSBezierPath fillRect:[view()->getView() visibleRect]];
#endif

    if (renderer()) {
        if (_needsToSetWidgetsAside) {
            moveWidgetsAside(renderer());
            _needsToSetWidgetsAside = false;
        }
        renderer()->layer()->paint(p, rect.x(), rect.y(), rect.width(), rect.height());
    }
}

DocumentImpl *KWQKHTMLPart::document()
{
    return part->xmlDocImpl();
}

RenderObject *KWQKHTMLPart::renderer()
{
    DocumentImpl *doc = part->xmlDocImpl();
    return doc ? doc->renderer() : 0;
}

QString KWQKHTMLPart::userAgent() const
{
    return QString::fromNSString([_bridge userAgentForURL:part->m_url.getNSURL()]);
}

NSView *KWQKHTMLPart::nextKeyViewInFrame(NodeImpl *node, KWQSelectionDirection direction)
{
    DocumentImpl *doc = document();
    for (;;) {
        node = direction == KWQSelectingNext
            ? doc->nextFocusNode(node) : doc->previousFocusNode(node);
        if (!node) {
            return nil;
        }
        RenderWidget *renderWidget = dynamic_cast<RenderWidget *>(node->renderer());
        if (renderWidget) {
            QWidget *widget = renderWidget->widget();
            KHTMLView *childFrameWidget = dynamic_cast<KHTMLView *>(widget);
            if (childFrameWidget) {
                NSView *view = childFrameWidget->part()->kwq->nextKeyViewInFrame(0, direction);
                if (view) {
                    return view;
                }
            } else if (widget) {
                NSView *view = widget->getView();
                // AppKit won't be able to handle scrolling and making us the first responder
                // well unless we are actually installed in the correct place. KHTML only does
                // that for visible widgets, so we need to do it explicitly here.
                int x, y;
                if (view && renderWidget->absolutePosition(x, y)) {
                    renderWidget->view()->addChild(widget, x, y);
                    return view;
                }
            }
        }
    }
}

NSView *KWQKHTMLPart::nextKeyViewInFrameHierarchy(NodeImpl *node, KWQSelectionDirection direction)
{
    NSView *next = nextKeyViewInFrame(node, direction);
    if (next) {
        return next;
    }
    
    KHTMLPart *parentPart = part->parentPart();
    if (parentPart) {
        next = parentPart->kwq->nextKeyView(parentPart->frame(part)->m_frame->element(), direction);
        if (next) {
            return next;
        }
    }
    
    return nil;
}

NSView *KWQKHTMLPart::nextKeyView(NodeImpl *node, KWQSelectionDirection direction)
{
    NSView *next = nextKeyViewInFrameHierarchy(node, direction);
    if (next) {
        return next;
    }

    // Look at views from the top level part up, looking for a next key view that we can use.
    next = direction == KWQSelectingNext
        ? [_bridge nextKeyViewOutsideWebViews]
        : [_bridge previousKeyViewOutsideWebViews];
    if (next) {
        return next;
    }
    
    // If all else fails, make a loop by starting from 0.
    return nextKeyViewInFrameHierarchy(0, direction);
}

NSView *KWQKHTMLPart::nextKeyViewForWidget(QWidget *startingWidget, KWQSelectionDirection direction)
{
    // Use the event filter object to figure out which RenderWidget owns this QWidget and get to the DOM.
    // Then get the next key view in the order determined by the DOM.
    NodeImpl *node = nodeForWidget(startingWidget);
    return partForNode(node)->nextKeyView(node, direction);
}

WebCoreBridge *KWQKHTMLPart::bridgeForWidget(QWidget *widget)
{
    return partForNode(nodeForWidget(widget))->bridge();
}

KWQKHTMLPart *KWQKHTMLPart::partForNode(NodeImpl *node)
{
    return node->getDocument()->view()->part()->kwq;
}

NodeImpl *KWQKHTMLPart::nodeForWidget(QWidget *widget)
{
    return static_cast<const RenderWidget *>(widget->eventFilterObject())->element();
}

void KWQKHTMLPart::setDocumentFocus(QWidget *widget)
{
    NodeImpl *node = nodeForWidget(widget);
    node->getDocument()->setFocusNode(node);
}

void KWQKHTMLPart::clearDocumentFocus(QWidget *widget)
{
    nodeForWidget(widget)->getDocument()->setFocusNode(0);
}

void KWQKHTMLPart::saveDocumentState()
{
    [_bridge saveDocumentState];
}

void KWQKHTMLPart::restoreDocumentState()
{
    [_bridge restoreDocumentState];
}

QPtrList<KWQKHTMLPart> &KWQKHTMLPart::mutableInstances()
{
    static QPtrList<KWQKHTMLPart> instancesList;
    return instancesList;
}

void KWQKHTMLPart::updatePolicyBaseURL()
{
    if (part->parentPart()) {
        setPolicyBaseURL(part->parentPart()->docImpl()->policyBaseURL());
    } else {
        setPolicyBaseURL(part->m_url.url());
    }
}

void KWQKHTMLPart::setPolicyBaseURL(const DOM::DOMString &s)
{
    // XML documents will cause this to return null.  docImpl() is
    // an HTMLdocument only. -dwh
    if (part->docImpl())
        part->docImpl()->setPolicyBaseURL(s);
    ConstFrameIt end = d->m_frames.end();
    for (ConstFrameIt it = d->m_frames.begin(); it != end; ++it) {
        ReadOnlyPart *subpart = (*it).m_part;
        static_cast<KHTMLPart *>(subpart)->kwq->setPolicyBaseURL(s);
    }
}

QString KWQKHTMLPart::requestedURLString() const
{
    return QString::fromNSString([[_bridge requestedURL] absoluteString]);
}

void KWQKHTMLPart::forceLayout()
{
    KHTMLView *v = d->m_view;
    if (v) {
        v->layout();
        v->unscheduleRelayout();
    }
}

QString KWQKHTMLPart::referrer() const
{
    return d->m_referrer;
}

void KWQKHTMLPart::runJavaScriptAlert(const QString &message)
{
    [[WebCoreViewFactory sharedFactory] runJavaScriptAlertPanelWithMessage:message.getNSString()];
}

bool KWQKHTMLPart::runJavaScriptConfirm(const QString &message)
{
    return [[WebCoreViewFactory sharedFactory] runJavaScriptConfirmPanelWithMessage:message.getNSString()];
}

bool KWQKHTMLPart::runJavaScriptPrompt(const QString &prompt, const QString &defaultValue, QString &result)
{
    NSString *returnedText;
    bool ok = [[WebCoreViewFactory sharedFactory] runJavaScriptTextInputPanelWithPrompt:prompt.getNSString()
        defaultText:defaultValue.getNSString() returningText:&returnedText];
    if (ok)
        result = QString::fromNSString(returnedText);
    return ok;
}
