import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MetadataFilter } from '../metadata-filter'

// Mock documents with metadata
const mockDocuments = [
  {
    customMetadata: [
      { key: 'author', stringValue: 'John' },
      { key: 'year', numericValue: 2024 },
    ],
  },
  {
    customMetadata: [
      { key: 'author', stringValue: 'Jane' },
      { key: 'category', stringValue: 'tech' },
    ],
  },
]

describe('MetadataFilter', () => {
  it('renders filter button', () => {
    const onFilterChange = vi.fn()
    render(
      <MetadataFilter
        documents={mockDocuments}
        onFilterChange={onFilterChange}
        currentFilter=""
      />
    )

    expect(screen.getByText('Filter by Metadata')).toBeInTheDocument()
  })

  it('shows "Filter Active" when filter is applied', () => {
    const onFilterChange = vi.fn()
    render(
      <MetadataFilter
        documents={mockDocuments}
        onFilterChange={onFilterChange}
        currentFilter="author='John'"
      />
    )

    expect(screen.getByText('Filter Active')).toBeInTheDocument()
  })

  it('displays current filter as a badge', () => {
    const onFilterChange = vi.fn()
    render(
      <MetadataFilter
        documents={mockDocuments}
        onFilterChange={onFilterChange}
        currentFilter="author='John'"
      />
    )

    expect(screen.getByText("author='John'")).toBeInTheDocument()
  })

  it('opens filter builder when button clicked', () => {
    const onFilterChange = vi.fn()
    render(
      <MetadataFilter
        documents={mockDocuments}
        onFilterChange={onFilterChange}
        currentFilter=""
      />
    )

    fireEvent.click(screen.getByText('Filter by Metadata'))

    // Should show condition inputs
    expect(screen.getByPlaceholderText('Key')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Value')).toBeInTheDocument()
  })

  it('generates correct filter syntax for string values', () => {
    const onFilterChange = vi.fn()
    render(
      <MetadataFilter
        documents={mockDocuments}
        onFilterChange={onFilterChange}
        currentFilter=""
      />
    )

    // Open filter builder
    fireEvent.click(screen.getByText('Filter by Metadata'))

    // Fill in condition
    const keyInput = screen.getByPlaceholderText('Key')
    const valueInput = screen.getByPlaceholderText('Value')

    fireEvent.change(keyInput, { target: { value: 'author' } })
    fireEvent.change(valueInput, { target: { value: 'John' } })

    // Apply filter
    fireEvent.click(screen.getByText('Apply Filter'))

    expect(onFilterChange).toHaveBeenCalledWith("author='John'")
  })

  it('generates correct filter syntax for numeric values', () => {
    const onFilterChange = vi.fn()
    render(
      <MetadataFilter
        documents={mockDocuments}
        onFilterChange={onFilterChange}
        currentFilter=""
      />
    )

    // Open filter builder
    fireEvent.click(screen.getByText('Filter by Metadata'))

    // Fill in numeric condition
    const keyInput = screen.getByPlaceholderText('Key')
    const valueInput = screen.getByPlaceholderText('Value')

    fireEvent.change(keyInput, { target: { value: 'year' } })
    fireEvent.change(valueInput, { target: { value: '2024' } })

    // Apply filter
    fireEvent.click(screen.getByText('Apply Filter'))

    // Numeric values should not have quotes
    expect(onFilterChange).toHaveBeenCalledWith('year=2024')
  })

  it('clears filter when clear button is clicked', () => {
    const onFilterChange = vi.fn()
    render(
      <MetadataFilter
        documents={mockDocuments}
        onFilterChange={onFilterChange}
        currentFilter="author='John'"
      />
    )

    // Find and click the X button on the filter badge
    const clearButtons = screen.getAllByRole('button')
    const clearBadgeButton = clearButtons.find(btn =>
      btn.querySelector('svg.h-3.w-3')
    )

    if (clearBadgeButton) {
      fireEvent.click(clearBadgeButton)
      expect(onFilterChange).toHaveBeenCalledWith('')
    }
  })

  it('adds multiple conditions with AND operator', () => {
    const onFilterChange = vi.fn()
    render(
      <MetadataFilter
        documents={mockDocuments}
        onFilterChange={onFilterChange}
        currentFilter=""
      />
    )

    // Open filter builder
    fireEvent.click(screen.getByText('Filter by Metadata'))

    // Fill first condition
    const keyInputs = screen.getAllByPlaceholderText('Key')
    const valueInputs = screen.getAllByPlaceholderText('Value')

    fireEvent.change(keyInputs[0], { target: { value: 'author' } })
    fireEvent.change(valueInputs[0], { target: { value: 'John' } })

    // Add another condition
    fireEvent.click(screen.getByText('Add Condition'))

    // Fill second condition
    const newKeyInputs = screen.getAllByPlaceholderText('Key')
    const newValueInputs = screen.getAllByPlaceholderText('Value')

    fireEvent.change(newKeyInputs[1], { target: { value: 'year' } })
    fireEvent.change(newValueInputs[1], { target: { value: '2024' } })

    // Apply filter
    fireEvent.click(screen.getByText('Apply Filter'))

    expect(onFilterChange).toHaveBeenCalledWith("author='John' AND year=2024")
  })

  it('extracts unique keys from documents', () => {
    const onFilterChange = vi.fn()
    render(
      <MetadataFilter
        documents={mockDocuments}
        onFilterChange={onFilterChange}
        currentFilter=""
      />
    )

    // Open filter builder
    fireEvent.click(screen.getByText('Filter by Metadata'))

    // Check datalist options exist (the component uses datalist for autocomplete)
    const datalist = document.querySelector('datalist')
    expect(datalist).toBeInTheDocument()

    if (datalist) {
      const options = datalist.querySelectorAll('option')
      const values = Array.from(options).map(o => o.value)
      expect(values).toContain('author')
      expect(values).toContain('year')
      expect(values).toContain('category')
    }
  })
})
