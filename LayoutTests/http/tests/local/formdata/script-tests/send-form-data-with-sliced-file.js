description("Test for sending FormData with sliced files via XMLHttpRequest.");

function runTest()
{
    debug("Sending FormData containing one sliced file with empty name:");
    testSendingFormData([
        { 'type': 'file', 'name': '', 'value': '../resources/file-for-drag-to-send.txt' }
    ]);

    debug("Sending FormData containing one sliced file:");
    testSendingFormData([
        { 'type': 'file', 'name': 'file', 'value': '../resources/file-for-drag-to-send.txt', 'start' : 1, 'length' : 5 }
    ]);

    debug("Sending FormData containing one string and one sliced file:");
    testSendingFormData([
        { 'type': 'string', 'name': 'string1', 'value': 'foo' },
        { 'type': 'file', 'name': 'file1', 'value': '../resources/file-for-drag-to-send.txt', 'start' : 1, 'length' : 5 }
    ]);

    debug("Sending FormData containing two strings and two sliced files:");
    testSendingFormData([
        { 'type': 'string', 'name': 'string1', 'value': 'foo' },
        { 'type': 'file', 'name': 'file1', 'value': '../resources/file-for-drag-to-send.txt', 'start' : 1, 'length' : 5 },
        { 'type': 'string', 'name': 'string2', 'value': 'bar' },
        { 'type': 'file', 'name': 'file2', 'value': '../resources/file-for-drag-to-send.txt', 'start' : 3, 'length' : 2 }
    ]);
}

if (window.eventSender) {
    runTest();
    // Clean up after ourselves
    fileInput.parentNode.removeChild(fileInput);
} else {
    testFailed("This test is not interactive, please run using DumpRenderTree");
}

var successfullyParsed = true;
