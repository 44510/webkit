/*
 * Copyright (C) 2008 Apple Inc. All Rights Reserved.
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
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. 
 */

#ifndef ScrollbarThemeComposite_h
#define ScrollbarThemeComposite_h

#include "ScrollbarTheme.h"

namespace WebCore {

class ScrollbarThemeComposite : public ScrollbarTheme {
public:
    virtual bool paint(Scrollbar*, GraphicsContext* context, const IntRect& damageRect);

protected:
    virtual bool hasButtons(Scrollbar*) = 0;
    virtual bool hasThumb(Scrollbar*) = 0;

    virtual IntRect backButtonRect(Scrollbar*, bool painting = false) = 0;
    virtual IntRect forwardButtonRect(Scrollbar*, bool painting = false) = 0;
    virtual IntRect trackRect(Scrollbar*, bool painting = false) = 0;

    virtual void splitTrack(Scrollbar*, const IntRect& track, IntRect& startTrack, IntRect& thumb, IntRect& endTrack) = 0;
    
    // Assume the track is a single piece by default.
    virtual bool trackIsSinglePiece() { return true; }

    virtual void paintTrack(GraphicsContext*, Scrollbar*, const IntRect&, ScrollbarControlPartMask) = 0;
    virtual void paintButton(GraphicsContext*, Scrollbar*, const IntRect&, ScrollbarControlPartMask) = 0;
    virtual void paintThumb(GraphicsContext*, Scrollbar*, const IntRect&) = 0;
};

}
#endif
