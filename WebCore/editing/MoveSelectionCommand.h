/*
 * Copyright (C) 2005, 2006, 2008 Apple Inc. All rights reserved.
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

#ifndef MoveSelectionCommand_h
#define MoveSelectionCommand_h

#include "CompositeEditCommand.h"

namespace WebCore {

class DocumentFragment;

class MoveSelectionCommand : public CompositeEditCommand {
public:
    static PassRefPtr<MoveSelectionCommand> create(PassRefPtr<DocumentFragment> fragment, const Position& position, bool smartInsert = false, bool smartDelete = false)
    {
        return adoptRef(new MoveSelectionCommand(fragment, position, smartInsert, smartDelete));
    }

private:
    MoveSelectionCommand(PassRefPtr<DocumentFragment>, const Position&, bool smartInsert, bool smartDelete);

    virtual void doApply();
    virtual EditAction editingAction() const;
    
    RefPtr<DocumentFragment> m_fragment;
    Position m_position;
    bool m_smartInsert;
    bool m_smartDelete;
};

} // namespace WebCore

#endif // MoveSelectionCommand_h
