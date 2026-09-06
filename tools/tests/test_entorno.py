def test_dependencias_importan():
    import openpyxl, PIL, numpy, requests  # noqa: F401
    from PIL import features
    assert features.check("webp")
