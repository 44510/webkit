/*
 * Copyright (C) 2007, 2008 Apple Inc. All rights reserved.
 * Copyright (C) 2007 Staikos Computing Services Inc. <info@staikos.net>
 * Copyright (C) 2007 Trolltech ASA
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

#include "config.h"
#include "PlatformScrollBar.h"

#include "EventHandler.h"
#include "FrameView.h"
#include "Frame.h"
#include "GraphicsContext.h"
#include "IntRect.h"
#include "PlatformMouseEvent.h"
#include "ScrollbarTheme.h"

#include <QApplication>
#include <QDebug>
#include <QPainter>
#include <QStyle>
#include <QMenu>

using namespace std;

static QString tr(const char* text)
{
    return QCoreApplication::translate("QWebPage", text);
}

namespace WebCore {

PlatformScrollbar::PlatformScrollbar(ScrollbarClient* client, ScrollbarOrientation orientation, ScrollbarControlSize size)
    : Scrollbar(client, orientation, size)
{
}

static QStyle::SubControl scPart(const ScrollbarPart& part)
{
    switch (part) {
        case NoPart:
            return QStyle::SC_None;
        case BackButtonPart:
            return QStyle::SC_ScrollBarSubLine;
        case BackTrackPart:
            return QStyle::SC_ScrollBarSubPage;
        case ThumbPart:
            return QStyle::SC_ScrollBarSlider;
        case ForwardTrackPart:
            return QStyle::SC_ScrollBarAddPage;
        case ForwardButtonPart:
            return QStyle::SC_ScrollBarAddLine;
    }

    return QStyle::SC_None;
}

// FIXME: duplicate also in ScrollbarThemeQt.cpp
static QStyleOptionSlider* styleOptionSlider(Scrollbar* scrollbar)
{
    static QStyleOptionSlider opt;
    opt.rect = scrollbar->frameGeometry();
    opt.state = 0;
    if (scrollbar->isEnabled())
        opt.state |= QStyle::State_Enabled;
    if (scrollbar->controlSize() != RegularScrollbar)
        opt.state |= QStyle::State_Mini;
    opt.orientation = (scrollbar->orientation() == VerticalScrollbar) ? Qt::Vertical : Qt::Horizontal;
    opt.sliderValue = scrollbar->value();
    opt.sliderPosition = opt.sliderValue;
    opt.pageStep = scrollbar->visibleSize();
    opt.singleStep = scrollbar->lineStep();
    opt.minimum = 0;
    opt.maximum = qMax(0, scrollbar->maximum());
    ScrollbarPart pressedPart = scrollbar->pressedPart();
    ScrollbarPart hoveredPart = scrollbar->hoveredPart();
    if (pressedPart != NoPart) {
        opt.activeSubControls = scPart(scrollbar->pressedPart());
        if (pressedPart == BackButtonPart || pressedPart == ForwardButtonPart ||
            pressedPart == ThumbPart)
            opt.state |= QStyle::State_Sunken;
    } else
        opt.activeSubControls = scPart(hoveredPart);
    if (hoveredPart != NoPart)
        opt.state |= QStyle::State_MouseOver;
    return &opt;
}

static int thumbLength(PlatformScrollbar *scrollbar)
{
    QStyleOptionSlider *option = styleOptionSlider(scrollbar);
    IntRect thumb = QApplication::style()->subControlRect(QStyle::CC_ScrollBar, option, QStyle::SC_ScrollBarSlider, 0);
    return scrollbar->orientation() == HorizontalScrollbar ? thumb.width() : thumb.height();
}

static int pixelPosToRangeValue(PlatformScrollbar* scrollbar, int pos)
{
    QStyleOptionSlider *option = styleOptionSlider(scrollbar);
    int thumbLen = thumbLength(scrollbar);

    IntRect track = QApplication::style()->subControlRect(QStyle::CC_ScrollBar, option,
                                                          QStyle::SC_ScrollBarGroove, 0);
    int thumbMin, thumbMax;
    if (scrollbar->orientation() == HorizontalScrollbar) {
        thumbMin = track.x();
        thumbMax = track.right() - thumbLen + 1;
    } else {
        thumbMin = track.y();
        thumbMax = track.bottom() - thumbLen + 1;
    }

    return  QStyle::sliderValueFromPosition(0, scrollbar->maximum(), pos - thumbMin,
                                            thumbMax - thumbMin, option->upsideDown);
}

bool PlatformScrollbar::handleContextMenuEvent(const PlatformMouseEvent& event)
{
#ifndef QT_NO_CONTEXTMENU
    bool horizontal = (m_orientation == HorizontalScrollbar);

    QMenu menu;
    QAction* actScrollHere = menu.addAction(tr("Scroll here"));
    menu.addSeparator();

    QAction* actScrollTop = menu.addAction(horizontal ? tr("Left edge") : tr("Top"));
    QAction* actScrollBottom = menu.addAction(horizontal ? tr("Right edge") : tr("Bottom"));
    menu.addSeparator();

    QAction* actPageUp = menu.addAction(horizontal ? tr("Page left") : tr("Page up"));
    QAction* actPageDown = menu.addAction(horizontal ? tr("Page right") : tr("Page down"));
    menu.addSeparator();

    QAction* actScrollUp = menu.addAction(horizontal ? tr("Scroll left") : tr("Scroll up"));
    QAction* actScrollDown = menu.addAction(horizontal ? tr("Scroll right") : tr("Scroll down"));

    const QPoint globalPos = QPoint(event.globalX(), event.globalY());
    QAction* actionSelected = menu.exec(globalPos);

    if (actionSelected == 0)
        /* Do nothing */ ;
    else if (actionSelected == actScrollHere) {
        const QPoint pos = convertFromContainingWindow(event.pos());
        setValue(pixelPosToRangeValue(this, horizontal ? pos.x() : pos.y()));
    } else if (actionSelected == actScrollTop)
        setValue(0);
    else if (actionSelected == actScrollBottom)
        setValue(m_totalSize - m_visibleSize);
    else if (actionSelected == actPageUp)
        scroll(horizontal ? ScrollLeft: ScrollUp, ScrollByPage, 1);
    else if (actionSelected == actPageDown)
        scroll(horizontal ? ScrollRight : ScrollDown, ScrollByPage, 1);
    else if (actionSelected == actScrollUp)
        scroll(horizontal ? ScrollLeft : ScrollUp, ScrollByLine, 1);
    else if (actionSelected == actScrollDown)
        scroll(horizontal ? ScrollRight : ScrollDown, ScrollByLine, 1);
#endif // QT_NO_CONTEXTMENU
    return true;
}

void PlatformScrollbar::invalidate()
{
    // Get the root widget.
    ScrollView* outermostView = topLevel();
    if (!outermostView)
        return;
    IntRect windowRect = convertToContainingWindow(IntRect(0, 0, width(), height()));
    outermostView->addToDirtyRegion(windowRect);
}

}

// vim: ts=4 sw=4 et
